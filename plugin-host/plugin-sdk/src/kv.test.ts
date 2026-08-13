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
import {kv} from "./kv";
import {stubWasmGlobals} from "./test-support/wasm-globals";

/**
 * The `kv` wrapper (plan §18.7). Unlike the other wrappers it *interprets* the host's reply — a 404
 * becomes `{found: false}` rather than an error — so a plugin can tell "no value stored" from "the
 * value is null" without checking status codes. Every other non-200 throws, on every operation: a
 * denied capability must never read as an empty result or a silent no-op.
 */
describe("kv", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("get", () => {
    it("returns the value with found: true", () => {
      const stub = stubWasmGlobals("kv");
      stub.replyWith({status: 200, value: 7});

      expect(kv.get<number>("view-count")).toEqual({found: true, value: 7});
      expect(stub.requests[0]).toEqual({op: "get", key: "view-count"});
    });

    it("maps a 404 to found: false with an undefined value", () => {
      const stub = stubWasmGlobals("kv");
      stub.replyWith({status: 404});

      expect(kv.get("never-written")).toEqual({found: false, value: undefined});
    });

    it("distinguishes a stored null from a missing key", () => {
      const stub = stubWasmGlobals("kv");
      stub.replyWith({status: 200, value: null});

      expect(kv.get("explicit-null")).toEqual({found: true, value: null});
    });

    it("rehydrates structured values", () => {
      const stub = stubWasmGlobals("kv");
      stub.replyWith({status: 200, value: {a: [1, 2], nested: {b: "x"}}});

      expect(kv.get("state").value).toEqual({a: [1, 2], nested: {b: "x"}});
    });

    it("throws for a failure status rather than reporting found: true with no value", () => {
      const stub = stubWasmGlobals("kv");
      stub.replyWith({status: 403, error: "Capability 'kv' not granted for this configuration"});

      expect(() => kv.get("k")).toThrow(
        "kv.get failed: Capability 'kv' not granted for this configuration"
      );
    });
  });

  describe("set", () => {
    it("sends the key and value and returns nothing on success", () => {
      const stub = stubWasmGlobals("kv");
      stub.replyWith({status: 200});

      expect(kv.set("view-count", 8)).toBeUndefined();
      expect(stub.requests[0]).toEqual({op: "set", key: "view-count", value: 8});
    });

    it("sends an explicit null value rather than dropping the field", () => {
      const stub = stubWasmGlobals("kv");
      stub.replyWith({status: 200});

      kv.set("k", null);

      expect(stub.requests[0]).toEqual({op: "set", key: "k", value: null});
    });

    it("throws when the host reports a rejection with a reason", () => {
      // e.g. the 256-character key cap — a silent no-op would lose the plugin's data unnoticed.
      const stub = stubWasmGlobals("kv");
      stub.replyWith({status: 400, error: "Key exceeds 256 characters"});

      expect(() => kv.set("k".repeat(300), 1)).toThrow(
        "kv.set failed: Key exceeds 256 characters"
      );
    });

    it("throws for a non-200 status even when the host gives no reason", () => {
      // Staying silent here would let a plugin believe a failed write succeeded.
      const stub = stubWasmGlobals("kv");
      stub.replyWith({status: 500});

      expect(() => kv.set("k", 1)).toThrow("kv.set failed: host returned status 500");
    });
  });

  describe("delete", () => {
    it("returns true when the host removed a row and false when there was nothing to remove", () => {
      const stub = stubWasmGlobals("kv");
      stub.replyWith({status: 200});
      stub.replyWith({status: 404});

      expect(kv.delete("k")).toBe(true);
      expect(kv.delete("k")).toBe(false);
      expect(stub.requests[0]).toEqual({op: "delete", key: "k"});
    });

    it("throws for a failure status rather than reporting 'nothing to remove'", () => {
      const stub = stubWasmGlobals("kv");
      stub.replyWith({status: 500});

      expect(() => kv.delete("k")).toThrow("kv.delete failed: host returned status 500");
    });
  });

  describe("list", () => {
    it("returns the keys the host reports", () => {
      const stub = stubWasmGlobals("kv");
      stub.replyWith({status: 200, keys: ["a", "b"]});

      expect(kv.list()).toEqual(["a", "b"]);
      expect(stub.requests[0]).toEqual({op: "list"});
    });

    it("forwards a prefix", () => {
      const stub = stubWasmGlobals("kv");
      stub.replyWith({status: 200, keys: ["user:1"]});

      expect(kv.list("user:")).toEqual(["user:1"]);
      expect(stub.requests[0]).toEqual({op: "list", prefix: "user:"});
    });

    it("throws when the capability is denied instead of reporting zero keys", () => {
      // An empty array is indistinguishable from "nothing stored", which hides the denial.
      const stub = stubWasmGlobals("kv");
      stub.replyWith({status: 403, error: "Capability 'kv' not granted for this configuration"});

      expect(() => kv.list()).toThrow(
        "kv.list failed: Capability 'kv' not granted for this configuration"
      );
    });

    it("returns an empty array for a 200 that carries no keys field", () => {
      const stub = stubWasmGlobals("kv");
      stub.replyWith({status: 200});

      expect(kv.list()).toEqual([]);
    });
  });

  describe("outside a compiled plugin", () => {
    it("throws a clear error when the Wasm globals are missing", () => {
      stubWasmGlobals("kv", {hostMissing: true});
      expect(() => kv.get("k")).toThrow(/only callable from inside a compiled Wasm plugin/);
    });

    it("throws a capability hint when the host function is absent from the import table", () => {
      stubWasmGlobals("kv", {fnMissing: true});
      expect(() => kv.get("k")).toThrow(/Ensure 'kv' is declared in permissions.capabilities/);
    });
  });
});
