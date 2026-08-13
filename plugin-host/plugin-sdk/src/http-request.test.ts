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

import {afterEach, describe, expect, it, vi} from "vitest";
import {httpRequest} from "./http-request";
import {stubWasmGlobals} from "./test-support/wasm-globals";

/**
 * The `httpRequest` wrapper (plan §18.6). It mirrors `gzacApi`'s shape but targets external
 * services; the host does the fetch and applies the HTTPS/SSRF policy, so the wrapper's job is
 * purely the envelope and the reply pass-through.
 */
describe("httpRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends GET with the url and no body", () => {
    const stub = stubWasmGlobals("http_request");
    stub.replyWith({status: 200, headers: {}, body: {id: 1}});

    httpRequest.get("https://jsonplaceholder.typicode.com/todos/1");

    expect(stub.requests[0]).toEqual({
      method: "GET",
      url: "https://jsonplaceholder.typicode.com/todos/1",
    });
  });

  it.each([
    ["post", "POST", () => httpRequest.post("https://api.example.com/x", {a: 1})],
    ["put", "PUT", () => httpRequest.put("https://api.example.com/x", {a: 1})],
  ])("sends %s with the body", (_label, method, call) => {
    const stub = stubWasmGlobals("http_request");
    stub.replyWith({status: 200, headers: {}, body: {}});

    call();

    expect(stub.requests[0]).toEqual({method, url: "https://api.example.com/x", body: {a: 1}});
  });

  it("sends DELETE with the url and no body", () => {
    const stub = stubWasmGlobals("http_request");
    stub.replyWith({status: 204, headers: {}, body: null});

    httpRequest.delete("https://api.example.com/x");

    expect(stub.requests[0]).toEqual({method: "DELETE", url: "https://api.example.com/x"});
  });

  it("forwards caller headers on every verb", () => {
    const stub = stubWasmGlobals("http_request");
    for (let i = 0; i < 4; i++) stub.replyWith({status: 200, headers: {}, body: {}});

    httpRequest.get("https://api.example.com/x", {Authorization: "Bearer upstream"});
    httpRequest.post("https://api.example.com/x", {}, {"X-A": "1"});
    httpRequest.put("https://api.example.com/x", {}, {"X-B": "2"});
    httpRequest.delete("https://api.example.com/x", {"X-C": "3"});

    expect(stub.requests.map((r) => (r as {headers?: unknown}).headers)).toEqual([
      {Authorization: "Bearer upstream"},
      {"X-A": "1"},
      {"X-B": "2"},
      {"X-C": "3"},
    ]);
  });

  it("returns the host's reply verbatim, including the parsed body and headers", () => {
    const stub = stubWasmGlobals("http_request");
    stub.replyWith({
      status: 200,
      headers: {"content-type": "application/json"},
      body: {id: 1, title: "delectus aut autem", completed: false},
    });

    const res = httpRequest.get<{id: number; title: string}>("https://api.example.com/todos/1");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({id: 1, title: "delectus aut autem", completed: false});
    expect(res.headers).toEqual({"content-type": "application/json"});
  });

  it("passes a host-side policy rejection through as data rather than throwing", () => {
    // e.g. the SSRF guard or the HTTPS-only rule refusing the target (§18.6).
    const stub = stubWasmGlobals("http_request");
    stub.replyWith({
      status: 400,
      headers: {},
      body: {error: "IP address 127.0.0.1 is in a private or reserved range"},
    });

    const res = httpRequest.get("https://127.0.0.1/admin");

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({error: expect.stringContaining("private or reserved") as string});
  });

  describe("outside a compiled plugin", () => {
    it("throws a clear error when the Wasm globals are missing", () => {
      stubWasmGlobals("http_request", {hostMissing: true});
      expect(() => httpRequest.get("https://api.example.com/x")).toThrow(
        /only callable from inside a compiled Wasm plugin/
      );
    });

    it("throws a capability hint when the host function is absent from the import table", () => {
      stubWasmGlobals("http_request", {fnMissing: true});
      expect(() => httpRequest.get("https://api.example.com/x")).toThrow(
        /Ensure 'http_request' is declared in permissions.capabilities/
      );
    });
  });
});
