/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export interface MemoryLimitResult {
  bytes: Uint8Array;
  applied: boolean;
  /** Why the cap could not be applied (or had to be clamped), for a one-time warning at load. */
  reason?: string;
}

/** Wasm section id for the memory section. */
const SECTION_MEMORY = 5;
/** Limits flag bits: 0x01 = a maximum is present, 0x02 = shared memory (threads). */
const FLAG_HAS_MAX = 0x01;
const FLAG_SHARED = 0x02;

/**
 * Rewrites a Wasm module's memory declaration so its linear memory carries a `maximum` of
 * `maxPages`, and returns the patched bytes.
 *
 * This is the only limit the engine enforces on guest memory growth. Extism's own `maxPages`
 * option bounds just the buffers the host allocates to pass input and output across the sandbox
 * boundary; the guest declares and exports its own linear memory, so a JS plugin's QuickJS heap can
 * otherwise grow far past the configured cap. With a `maximum` in place, `memory.grow` fails and
 * the guest allocator reports out of memory, which surfaces as a failed call.
 *
 * The patch is applied to an in-memory copy only — the stored package keeps the exact bytes its
 * content hash was pinned against.
 *
 * Never throws: a module this walker cannot parse is one Extism would reject anyway, and failing
 * the load with a parser error would be worse than loading it uncapped with a warning.
 */
export function applyMaxMemoryPages(wasm: Uint8Array, maxPages: number): MemoryLimitResult {
  if (!Number.isInteger(maxPages) || maxPages <= 0) {
    return { bytes: wasm, applied: false, reason: "memory cap is disabled" };
  }
  if (wasm.length < 8) {
    return { bytes: wasm, applied: false, reason: "module is too short to be Wasm" };
  }
  // \0asm magic + version 1.
  if (wasm[0] !== 0x00 || wasm[1] !== 0x61 || wasm[2] !== 0x73 || wasm[3] !== 0x6d) {
    return { bytes: wasm, applied: false, reason: "module does not carry the Wasm magic header" };
  }

  try {
    return patch(wasm, maxPages);
  } catch (err) {
    return {
      bytes: wasm,
      applied: false,
      reason: `could not parse the module's sections: ${(err as Error).message}`,
    };
  }
}

function patch(wasm: Uint8Array, maxPages: number): MemoryLimitResult {
  let offset = 8; // past magic + version
  while (offset < wasm.length) {
    const sectionId = wasm[offset];
    const sizeField = readLeb128(wasm, offset + 1);
    const payloadStart = sizeField.next;
    const payloadEnd = payloadStart + sizeField.value;
    if (payloadEnd > wasm.length) {
      throw new Error("section size runs past the end of the module");
    }

    if (sectionId === SECTION_MEMORY) {
      return patchMemorySection(wasm, offset, payloadStart, payloadEnd, maxPages);
    }
    offset = payloadEnd;
  }

  // No memory section: the module imports its memory from the host instead of declaring one, and
  // this host does not supply it (Extism instantiates without a memory import).
  return {
    bytes: wasm,
    applied: false,
    reason: "module declares no memory section (its memory is imported)",
  };
}

function patchMemorySection(
  wasm: Uint8Array,
  sectionStart: number,
  payloadStart: number,
  payloadEnd: number,
  maxPages: number
): MemoryLimitResult {
  const count = readLeb128(wasm, payloadStart);
  if (count.value !== 1) {
    return {
      bytes: wasm,
      applied: false,
      reason: `module declares ${count.value} memories; only a single memory can be capped`,
    };
  }

  const flags = wasm[count.next];
  const min = readLeb128(wasm, count.next + 1);
  let entryEnd = min.next;
  let declaredMax: number | undefined;
  if ((flags & FLAG_HAS_MAX) !== 0) {
    const max = readLeb128(wasm, min.next);
    declaredMax = max.value;
    entryEnd = max.next;
  }

  if ((flags & FLAG_SHARED) !== 0) {
    // Shared memory always declares a maximum and is used by threaded modules; rewriting it would
    // change the module's threading contract.
    return { bytes: wasm, applied: false, reason: "module declares a shared memory" };
  }

  let reason: string | undefined;
  let target = maxPages;
  if (declaredMax !== undefined && declaredMax <= maxPages) {
    // The module already binds itself tighter than the host would — leave it alone.
    return {
      bytes: wasm,
      applied: true,
      reason: `module already declares a maximum of ${declaredMax} pages`,
    };
  }
  if (target < min.value) {
    // A maximum below the module's own minimum makes the module invalid, so the minimum wins.
    target = min.value;
    reason = `memory cap of ${maxPages} pages is below the module's minimum of ${min.value} pages; clamped to the minimum`;
  }

  const newEntry = [FLAG_HAS_MAX, ...encodeLeb128(min.value), ...encodeLeb128(target)];
  const newPayload = [...encodeLeb128(1), ...newEntry];
  // Anything after the single memory entry is not valid in a memory section, so the payload is
  // rebuilt from scratch rather than spliced around.
  if (entryEnd !== payloadEnd) {
    throw new Error("memory section carries trailing bytes after its single entry");
  }

  const head = wasm.subarray(0, sectionStart);
  const tail = wasm.subarray(payloadEnd);
  const sizeBytes = encodeLeb128(newPayload.length);
  const out = new Uint8Array(head.length + 1 + sizeBytes.length + newPayload.length + tail.length);
  out.set(head, 0);
  out[head.length] = SECTION_MEMORY;
  out.set(sizeBytes, head.length + 1);
  out.set(newPayload, head.length + 1 + sizeBytes.length);
  out.set(tail, head.length + 1 + sizeBytes.length + newPayload.length);

  return { bytes: out, applied: true, reason };
}

/** Reads an unsigned LEB128 `u32`, returning its value and the offset just past it. */
function readLeb128(bytes: Uint8Array, start: number): { value: number; next: number } {
  let result = 0;
  let shift = 0;
  let offset = start;
  for (;;) {
    if (offset >= bytes.length) throw new Error("LEB128 value runs past the end of the module");
    const byte = bytes[offset++];
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
    if (shift > 28) throw new Error("LEB128 value is wider than u32");
  }
  return { value: result >>> 0, next: offset };
}

function encodeLeb128(value: number): number[] {
  const out: number[] = [];
  let remaining = value >>> 0;
  do {
    let byte = remaining & 0x7f;
    remaining >>>= 7;
    if (remaining !== 0) byte |= 0x80;
    out.push(byte);
  } while (remaining !== 0);
  return out;
}
