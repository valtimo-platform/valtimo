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

import type {KvGetResult} from "./models/index.js";

interface KvRequest {
  op: "get" | "set" | "delete" | "list";
  key?: string;
  value?: unknown;
  prefix?: string;
}

interface KvResponse {
  status: number;
  value?: unknown;
  keys?: string[];
  error?: string;
}

function callKv(req: KvRequest): KvResponse {
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
      "kv is only callable from inside a compiled Wasm plugin (Host/Memory globals missing)."
    );
  }

  const fn = HostGlobal.getFunctions().kv as
    | ((input: bigint | number) => bigint | number)
    | undefined;
  if (typeof fn !== "function") {
    throw new Error(
      "kv host function not found. Ensure 'kv' is declared in permissions.capabilities."
    );
  }

  const inputMem = MemoryGlobal.fromString(JSON.stringify(req));
  const replyPtr = fn(inputMem.offset);
  const replyJson = MemoryGlobal.find(replyPtr).readString();
  return JSON.parse(replyJson) as KvResponse;
}

/**
 * Fail on any status the operation does not treat as meaningful. Applied by every operation, so a
 * denied capability or a host-side failure can never read as an empty result or a silent no-op —
 * `error` is a nice-to-have detail in the message, not the trigger.
 */
function failUnless(op: string, res: KvResponse, okStatuses: number[]): void {
  if (okStatuses.includes(res.status)) {
    return;
  }
  throw new Error(
    `kv.${op} failed: ${res.error ?? `host returned status ${res.status}`}`
  );
}

export const kv = {
  get<T = unknown>(key: string): KvGetResult<T> {
    const res = callKv({ op: "get", key });
    // 404 is not a failure: it is how the host says "no value stored".
    failUnless("get", res, [200, 404]);
    if (res.status === 404) {
      return { found: false, value: undefined };
    }
    return { found: true, value: res.value as T };
  },

  set(key: string, value: unknown): void {
    const res = callKv({ op: "set", key, value });
    failUnless("set", res, [200]);
  },

  delete(key: string): boolean {
    const res = callKv({ op: "delete", key });
    // 404 is not a failure: it means there was nothing to remove.
    failUnless("delete", res, [200, 404]);
    return res.status === 200;
  },

  list(prefix?: string): string[] {
    const res = callKv({ op: "list", prefix });
    failUnless("list", res, [200]);
    return res.keys ?? [];
  },
};
