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

export const kv = {
  get<T = unknown>(key: string): KvGetResult<T> {
    const res = callKv({ op: "get", key });
    if (res.status === 404) {
      return { found: false, value: undefined };
    }
    return { found: true, value: res.value as T };
  },

  set(key: string, value: unknown): void {
    const res = callKv({ op: "set", key, value });
    if (res.status !== 200 && res.error) {
      throw new Error(`kv.set failed: ${res.error}`);
    }
  },

  delete(key: string): boolean {
    const res = callKv({ op: "delete", key });
    return res.status === 200;
  },

  list(prefix?: string): string[] {
    const res = callKv({ op: "list", prefix });
    return res.keys ?? [];
  },
};
