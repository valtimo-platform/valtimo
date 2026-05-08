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

import type {GzacApiResponse} from "./models/index.js";

/**
 * Wrapper around the `gzac_api` host function. Plugins call this to make authenticated callbacks
 * into the GZAC instance that owns their configuration. Auth and routing happen on the host —
 * the plugin only sees the response body.
 *
 * Calls are synchronous from the plugin's perspective: Extism suspends the Wasm call until the
 * host's async fetch resolves.
 *
 * Plugins must declare the host import in their `index.d.ts`:
 *
 * ```ts
 * declare module "extism:host" {
 *   interface user {
 *     gzac_api(input: PTR): PTR;
 *   }
 * }
 * ```
 */
interface GzacApiRequest {
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

function callGzacApi(req: GzacApiRequest): GzacApiResponse {
  // The Extism JS PDK exposes `Host` and `Memory` as ambient globals at runtime. Outside Wasm
  // (e.g. during local builds or tests) these aren't available and we throw a clear error.
  const HostGlobal = (globalThis as Record<string, unknown>).Host as
    | { getFunctions(): Record<string, unknown> }
    | undefined;
  const MemoryGlobal = (globalThis as Record<string, unknown>).Memory as
    | {
        fromString(s: string): { offset: bigint | number };
        find(offset: bigint | number): { readString(): string };
      }
    | undefined;

  if (!HostGlobal?.getFunctions || !MemoryGlobal?.fromString || !MemoryGlobal?.find) {
    throw new Error(
      "gzac_api is only callable from inside a compiled Wasm plugin (Host/Memory globals missing)."
    );
  }

  const fn = HostGlobal.getFunctions().gzac_api as
    | ((input: bigint | number) => bigint | number)
    | undefined;
  if (typeof fn !== "function") {
    throw new Error(
      "gzac_api host function not found. Did you declare it in your plugin's index.d.ts under `extism:host.user`?"
    );
  }

  const inputMem = MemoryGlobal.fromString(JSON.stringify(req));
  const replyPtr = fn(inputMem.offset);
  const replyJson = MemoryGlobal.find(replyPtr).readString();
  return JSON.parse(replyJson) as GzacApiResponse;
}

export const gzacApi = {
  get<T = unknown>(
    path: string,
    headers?: Record<string, string>
  ): GzacApiResponse<T> {
    return callGzacApi({ method: "GET", path, headers }) as GzacApiResponse<T>;
  },
  post<T = unknown>(
    path: string,
    body?: unknown,
    headers?: Record<string, string>
  ): GzacApiResponse<T> {
    return callGzacApi({ method: "POST", path, body, headers }) as GzacApiResponse<T>;
  },
  put<T = unknown>(
    path: string,
    body?: unknown,
    headers?: Record<string, string>
  ): GzacApiResponse<T> {
    return callGzacApi({ method: "PUT", path, body, headers }) as GzacApiResponse<T>;
  },
  delete<T = unknown>(
    path: string,
    headers?: Record<string, string>
  ): GzacApiResponse<T> {
    return callGzacApi({ method: "DELETE", path, headers }) as GzacApiResponse<T>;
  },
};
