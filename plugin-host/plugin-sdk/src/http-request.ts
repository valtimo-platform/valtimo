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

import type {HttpRequestResponse} from "./models/index.js";

interface HttpRequestInput {
  method: string;
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

function callHttpRequest(req: HttpRequestInput): HttpRequestResponse {
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
      "httpRequest is only callable from inside a compiled Wasm plugin (Host/Memory globals missing)."
    );
  }

  const fn = HostGlobal.getFunctions().http_request as
    | ((input: bigint | number) => bigint | number)
    | undefined;
  if (typeof fn !== "function") {
    throw new Error(
      "http_request host function not found. Ensure 'http_request' is declared in permissions.capabilities."
    );
  }

  const inputMem = MemoryGlobal.fromString(JSON.stringify(req));
  const replyPtr = fn(inputMem.offset);
  const replyJson = MemoryGlobal.find(replyPtr).readString();
  return JSON.parse(replyJson) as HttpRequestResponse;
}

export const httpRequest = {
  get<T = unknown>(url: string, headers?: Record<string, string>): HttpRequestResponse<T> {
    return callHttpRequest({ method: "GET", url, headers }) as HttpRequestResponse<T>;
  },
  post<T = unknown>(url: string, body?: unknown, headers?: Record<string, string>): HttpRequestResponse<T> {
    return callHttpRequest({ method: "POST", url, body, headers }) as HttpRequestResponse<T>;
  },
  put<T = unknown>(url: string, body?: unknown, headers?: Record<string, string>): HttpRequestResponse<T> {
    return callHttpRequest({ method: "PUT", url, body, headers }) as HttpRequestResponse<T>;
  },
  delete<T = unknown>(url: string, headers?: Record<string, string>): HttpRequestResponse<T> {
    return callHttpRequest({ method: "DELETE", url, headers }) as HttpRequestResponse<T>;
  },
};
