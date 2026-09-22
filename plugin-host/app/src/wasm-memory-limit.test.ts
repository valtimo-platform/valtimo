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

/**
 * L1 tests for the Wasm memory-limit patcher. The modules here are hand-assembled rather than
 * compiled from a fixture, so each case pins one exact byte layout — and every patched module is
 * handed to `WebAssembly.compile`/`instantiate`, which is the only judge of whether the rewritten
 * section is still valid and whether the cap actually binds `memory.grow`.
 */

import {describe, expect, it} from "vitest";
import {applyMaxMemoryPages} from "./wasm-memory-limit";

const HEADER = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];

function leb128(value: number): number[] {
  const out: number[] = [];
  let remaining = value;
  do {
    let byte = remaining & 0x7f;
    remaining >>>= 7;
    if (remaining !== 0) byte |= 0x80;
    out.push(byte);
  } while (remaining !== 0);
  return out;
}

function section(id: number, payload: number[]): number[] {
  return [id, ...leb128(payload.length), ...payload];
}

function name(text: string): number[] {
  const bytes = [...Buffer.from(text, "utf8")];
  return [...leb128(bytes.length), ...bytes];
}

/** A memory section declaring one memory: `min` pages, optionally a `max`. */
function memorySection(min: number, max?: number): number[] {
  const entry =
    max === undefined ? [0x00, ...leb128(min)] : [0x01, ...leb128(min), ...leb128(max)];
  return section(5, [...leb128(1), ...entry]);
}

/** An export section publishing memory 0 as `memory` — what an Extism guest module does. */
const EXPORT_MEMORY = section(7, [...leb128(1), ...name("memory"), 0x02, 0x00]);

/**
 * A module with a memory section, plus surrounding sections so the splice has to preserve
 * neighbours. The custom section is deliberately >127 bytes so its size is a multi-byte LEB128 the
 * walker must skip correctly.
 */
function moduleWith(memory: number[]): Uint8Array {
  const bigCustom = section(0, [...name("producers"), ...new Array(200).fill(0x41)]);
  const types = section(1, [...leb128(0)]);
  return new Uint8Array([...HEADER, ...bigCustom, ...types, ...memory, ...EXPORT_MEMORY]);
}

/** Reads back the single memory entry so a test can assert on the patched declaration. */
function readMemoryLimits(bytes: Uint8Array): { flags: number; min: number; max?: number } {
  let offset = 8;
  while (offset < bytes.length) {
    const id = bytes[offset];
    const size = readLeb(bytes, offset + 1);
    if (id === 5) {
      const count = readLeb(bytes, size.next);
      expect(count.value).toBe(1);
      const flags = bytes[count.next];
      const min = readLeb(bytes, count.next + 1);
      if ((flags & 0x01) !== 0) {
        return { flags, min: min.value, max: readLeb(bytes, min.next).value };
      }
      return { flags, min: min.value };
    }
    offset = size.next + size.value;
  }
  throw new Error("no memory section");
}

function readLeb(bytes: Uint8Array, start: number): { value: number; next: number } {
  let value = 0;
  let shift = 0;
  let offset = start;
  for (;;) {
    const byte = bytes[offset++];
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  return { value: value >>> 0, next: offset };
}

describe("applyMaxMemoryPages", () => {
  describe("patching", () => {
    it("adds a maximum to a memory that declares none (flags 0 → 1)", () => {
      const original = moduleWith(memorySection(2));
      expect(readMemoryLimits(original)).toEqual({ flags: 0, min: 2 });

      const result = applyMaxMemoryPages(original, 64);

      expect(result.applied).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(readMemoryLimits(result.bytes)).toEqual({ flags: 1, min: 2, max: 64 });
    });

    it("lowers a maximum that is looser than the cap", () => {
      const result = applyMaxMemoryPages(moduleWith(memorySection(2, 10_000)), 64);
      expect(result.applied).toBe(true);
      expect(readMemoryLimits(result.bytes)).toEqual({ flags: 1, min: 2, max: 64 });
    });

    it("preserves a maximum the module already sets tighter than the cap", () => {
      const original = moduleWith(memorySection(2, 8));
      const result = applyMaxMemoryPages(original, 64);
      expect(result.applied).toBe(true);
      expect(result.bytes).toBe(original); // untouched
      expect(result.reason).toContain("already declares a maximum of 8 pages");
    });

    it("clamps a cap below the module's own minimum up to that minimum, and says so", () => {
      // A maximum below the declared minimum would make the module invalid, so the minimum wins.
      const result = applyMaxMemoryPages(moduleWith(memorySection(38)), 4);
      expect(result.applied).toBe(true);
      expect(readMemoryLimits(result.bytes)).toEqual({ flags: 1, min: 38, max: 38 });
      expect(result.reason).toContain("clamped to the minimum");
    });

    it("re-encodes a maximum that needs a multi-byte LEB128", () => {
      const result = applyMaxMemoryPages(moduleWith(memorySection(2)), 4096);
      expect(readMemoryLimits(result.bytes)).toEqual({ flags: 1, min: 2, max: 4096 });
    });

    it("leaves the surrounding sections byte-identical", () => {
      const memory = memorySection(2);
      const original = moduleWith(memory);
      const patched = applyMaxMemoryPages(original, 64).bytes;

      // Everything before the memory section, and everything after it, is untouched; only the
      // memory section itself grew by the two bytes of the new maximum.
      const memoryStart = indexOfSequence(original, memory);
      expect(memoryStart).toBeGreaterThan(0);
      expect([...patched.subarray(0, memoryStart)]).toEqual([...original.subarray(0, memoryStart)]);
      const tail = original.subarray(memoryStart + memory.length);
      expect([...patched.subarray(patched.length - tail.length)]).toEqual([...tail]);
    });
  });

  describe("validity of the patched module", () => {
    it("still compiles, and the cap binds memory.grow", async () => {
      const patched = applyMaxMemoryPages(moduleWith(memorySection(2)), 4);
      const module = await WebAssembly.compile(patched.bytes as BufferSource);
      const instance = await WebAssembly.instantiate(module);
      const memory = instance.exports.memory as WebAssembly.Memory;

      expect(memory.buffer.byteLength).toBe(2 * 65536);
      expect(memory.grow(2)).toBe(2); // up to the cap of 4 pages
      // Past the cap the engine refuses to grow — the failure mode the host relies on.
      expect(() => memory.grow(1)).toThrow(RangeError);
    });

    it("compiles an unpatched-but-capped module the same way it did before", async () => {
      const original = moduleWith(memorySection(2, 8));
      await expect(
        WebAssembly.compile(applyMaxMemoryPages(original, 64).bytes as BufferSource)
      ).resolves.toBeInstanceOf(WebAssembly.Module);
    });
  });

  describe("modules the cap cannot be applied to", () => {
    it("returns the bytes unchanged when the cap is disabled (0)", () => {
      const original = moduleWith(memorySection(2));
      const result = applyMaxMemoryPages(original, 0);
      expect(result).toEqual({ bytes: original, applied: false, reason: "memory cap is disabled" });
    });

    it.each([
      ["a negative cap", -1],
      ["a fractional cap", 1.5],
      ["NaN", Number.NaN],
    ])("returns the bytes unchanged for %s", (_label, maxPages) => {
      const original = moduleWith(memorySection(2));
      const result = applyMaxMemoryPages(original, maxPages);
      expect(result.applied).toBe(false);
      expect(result.bytes).toBe(original);
    });

    it("reports a module whose memory is imported rather than declared", () => {
      // Extism instantiates without supplying a memory import, so this host cannot bound it.
      const importSection = section(2, [
        ...leb128(1),
        ...name("env"),
        ...name("memory"),
        0x02,
        0x00,
        ...leb128(1),
      ]);
      const bytes = new Uint8Array([...HEADER, ...importSection]);

      const result = applyMaxMemoryPages(bytes, 64);
      expect(result.applied).toBe(false);
      expect(result.reason).toContain("no memory section");
      expect(result.bytes).toBe(bytes);
    });

    it("reports a multi-memory module", () => {
      const twoMemories = section(5, [...leb128(2), 0x00, 0x01, 0x00, 0x01]);
      const result = applyMaxMemoryPages(moduleWith(twoMemories), 64);
      expect(result.applied).toBe(false);
      expect(result.reason).toContain("only a single memory can be capped");
    });

    it("reports a shared memory rather than rewriting a threaded module's contract", () => {
      const shared = section(5, [...leb128(1), 0x03, ...leb128(2), ...leb128(10_000)]);
      const result = applyMaxMemoryPages(moduleWith(shared), 64);
      expect(result.applied).toBe(false);
      expect(result.reason).toContain("shared memory");
    });

    it.each([
      ["non-Wasm input", new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00])],
      ["an empty buffer", new Uint8Array()],
      ["a truncated header", new Uint8Array([0x00, 0x61, 0x73])],
    ])("returns %s unchanged instead of throwing", (_label, bytes) => {
      const result = applyMaxMemoryPages(bytes, 64);
      expect(result.applied).toBe(false);
      expect(result.bytes).toBe(bytes);
      expect(result.reason).toBeDefined();
    });

    it("reports a module whose section size runs past the end", () => {
      // A malformed module must degrade to "uncapped, with a reason" — never crash the load, since
      // Extism would reject it a moment later anyway with a much clearer message.
      const bytes = new Uint8Array([...HEADER, 0x05, 0x7f, 0x01, 0x00, 0x02]);
      const result = applyMaxMemoryPages(bytes, 64);
      expect(result.applied).toBe(false);
      expect(result.reason).toContain("could not parse");
      expect(result.bytes).toBe(bytes);
    });
  });
});

function indexOfSequence(haystack: Uint8Array, needle: number[]): number {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}
