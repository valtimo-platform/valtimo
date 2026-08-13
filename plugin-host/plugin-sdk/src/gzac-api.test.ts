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
import {gzacApi} from "./gzac-api";
import {stubWasmGlobals} from "./test-support/wasm-globals";

/**
 * The plugin-author-facing `gzacApi` wrapper (plan §9/§13.4). What matters here is the *request
 * envelope* it hands the host function — especially the `as` discriminator that selects between the
 * service token and the downscoped user token — because the host decides the credential from it.
 */
describe("gzacApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("request envelope", () => {
    it("sends GET with the path and no body", () => {
      const stub = stubWasmGlobals("gzac_api");
      stub.replyWith({status: 200, headers: {}, body: {ok: true}});

      gzacApi.get("/api/v1/document/1");

      expect(stub.requests[0]).toEqual({method: "GET", path: "/api/v1/document/1"});
    });

    it("sends POST/PUT with the body", () => {
      const stub = stubWasmGlobals("gzac_api");
      stub.replyWith({status: 201, headers: {}, body: {}});
      stub.replyWith({status: 200, headers: {}, body: {}});

      gzacApi.post("/api/v1/document/1/note", {note: "hello"});
      gzacApi.put("/api/v1/document/1", {title: "t"});

      expect(stub.requests[0]).toEqual({
        method: "POST",
        path: "/api/v1/document/1/note",
        body: {note: "hello"},
      });
      expect(stub.requests[1]).toEqual({
        method: "PUT",
        path: "/api/v1/document/1",
        body: {title: "t"},
      });
    });

    it("sends DELETE with the path and no body", () => {
      const stub = stubWasmGlobals("gzac_api");
      stub.replyWith({status: 204, headers: {}, body: null});

      gzacApi.delete("/api/v1/document/1");

      expect(stub.requests[0]).toEqual({method: "DELETE", path: "/api/v1/document/1"});
    });

    it("forwards caller headers", () => {
      const stub = stubWasmGlobals("gzac_api");
      stub.replyWith({status: 200, headers: {}, body: {}});

      gzacApi.get("/api/v1/document/1", {"X-Trace": "abc"});

      expect(stub.requests[0]).toMatchObject({headers: {"X-Trace": "abc"}});
    });
  });

  describe("credential selection", () => {
    it("omits `as` on the default surface — the host then uses the service token", () => {
      const stub = stubWasmGlobals("gzac_api");
      stub.replyWith({status: 200, headers: {}, body: {}});

      gzacApi.get("/api/v1/case/x/search");

      expect(stub.requests[0]).not.toHaveProperty("as");
    });

    it.each([
      ["get", () => gzacApi.asUser.get("/api/v1/case/x/search")],
      ["post", () => gzacApi.asUser.post("/api/v1/case/x/search", {})],
      ["put", () => gzacApi.asUser.put("/api/v1/case/x/search", {})],
      ["delete", () => gzacApi.asUser.delete("/api/v1/case/x/search")],
    ])("sets as:'user' on asUser.%s so the host picks the downscoped token", (_verb, call) => {
      const stub = stubWasmGlobals("gzac_api");
      stub.replyWith({status: 200, headers: {}, body: {}});

      call();

      expect(stub.requests[0]).toMatchObject({as: "user"});
    });

    it("keeps the two surfaces independent — asUser never leaks onto the service surface", () => {
      const stub = stubWasmGlobals("gzac_api");
      stub.replyWith({status: 200, headers: {}, body: {}});
      stub.replyWith({status: 200, headers: {}, body: {}});

      gzacApi.asUser.get("/api/v1/a");
      gzacApi.get("/api/v1/b");

      expect(stub.requests[0]).toMatchObject({as: "user"});
      expect(stub.requests[1]).not.toHaveProperty("as");
    });
  });

  describe("reply handling", () => {
    it("returns the host's reply verbatim", () => {
      const stub = stubWasmGlobals("gzac_api");
      stub.replyWith({status: 200, headers: {"content-type": "application/json"}, body: {a: 1}});

      const res = gzacApi.get<{a: number}>("/api/v1/x");

      expect(res).toEqual({
        status: 200,
        headers: {"content-type": "application/json"},
        body: {a: 1},
      });
    });

    it("passes a non-2xx status through instead of throwing — the plugin decides", () => {
      const stub = stubWasmGlobals("gzac_api");
      stub.replyWith({status: 403, headers: {}, body: {error: "not granted"}});

      const res = gzacApi.get("/api/v1/forbidden");

      expect(res.status).toBe(403);
      expect(res.body).toEqual({error: "not granted"});
    });

    it("surfaces the host's capability-denied reply as data, not an exception", () => {
      const stub = stubWasmGlobals("gzac_api");
      stub.replyWith({
        status: 403,
        headers: {},
        body: {error: "Capability 'gzac_api' not granted for this configuration"},
      });

      expect(() => gzacApi.get("/api/v1/x")).not.toThrow();
    });
  });

  describe("outside a compiled plugin", () => {
    it("throws a clear error when the Host global is missing", () => {
      stubWasmGlobals("gzac_api", {hostMissing: true});
      expect(() => gzacApi.get("/api/v1/x")).toThrow(
        /only callable from inside a compiled Wasm plugin/
      );
    });

    it("throws a clear error when the Memory global is missing", () => {
      stubWasmGlobals("gzac_api", {memoryMissing: true});
      expect(() => gzacApi.get("/api/v1/x")).toThrow(
        /only callable from inside a compiled Wasm plugin/
      );
    });

    it("throws a declaration hint when the host function is absent from the import table", () => {
      stubWasmGlobals("gzac_api", {fnMissing: true});
      expect(() => gzacApi.get("/api/v1/x")).toThrow(/gzac_api host function not found/);
    });
  });
});
