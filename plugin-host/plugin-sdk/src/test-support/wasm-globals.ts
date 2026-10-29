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

import {vi} from "vitest";

/**
 * Test double for the ambient `Host`/`Memory` globals the Extism JS PDK injects at runtime. The SDK's
 * host-function wrappers reach for `globalThis.Host.getFunctions()` and marshal JSON through
 * `Memory`, so stubbing these two globals is enough to observe exactly what a wrapper sends and to
 * feed back the reply a host function would return — no Wasm toolchain needed. The compiled
 * end-to-end behaviour is covered by the L3 suite in `plugin-host/app/test/wasm/`.
 */
export interface WasmGlobalsStub {
  /** The JSON payloads the SDK marshalled out, in call order, parsed. */
  requests: unknown[];
  /** Queue a reply for the next host-function call (JSON-serialised on the way back in). */
  replyWith(reply: unknown): void;
  /** The spy standing in for the named host function. */
  fn: ReturnType<typeof vi.fn>;
}

/**
 * Installs the stubbed globals for one named host function. Call inside a test; pair with
 * `vi.unstubAllGlobals()` in `afterEach`.
 *
 * @param name host-function name as exposed by `Host.getFunctions()` (e.g. `gzac_api`)
 * @param options `fnMissing` omits the function from the table (the "capability not declared" shape);
 *   `hostMissing` / `memoryMissing` drop the global entirely (running outside Wasm).
 */
export function stubWasmGlobals(
  name: string,
  options: {fnMissing?: boolean; hostMissing?: boolean; memoryMissing?: boolean} = {}
): WasmGlobalsStub {
  const requests: unknown[] = [];
  const replies: string[] = [];
  let nextOffset = 1;
  const memoryBlocks = new Map<number, string>();

  const fn = vi.fn((offset: bigint | number) => {
    const request = memoryBlocks.get(Number(offset));
    requests.push(request === undefined ? undefined : JSON.parse(request));
    const reply = replies.shift() ?? JSON.stringify({status: 200});
    const replyOffset = nextOffset++;
    memoryBlocks.set(replyOffset, reply);
    return replyOffset;
  });

  if (!options.hostMissing) {
    vi.stubGlobal("Host", {
      getFunctions: () => (options.fnMissing ? {} : {[name]: fn}),
    });
  }

  if (!options.memoryMissing) {
    vi.stubGlobal("Memory", {
      fromString: (s: string) => {
        const offset = nextOffset++;
        memoryBlocks.set(offset, s);
        return {offset};
      },
      find: (offset: bigint | number) => ({
        readString: () => memoryBlocks.get(Number(offset)) ?? "",
      }),
    });
  }

  return {
    requests,
    replyWith: (reply: unknown) => replies.push(JSON.stringify(reply)),
    fn,
  };
}
