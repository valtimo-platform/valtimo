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

import {beforeEach, describe, expect, it, vi} from "vitest";
import type {KvRepository} from "../db/kv-repository.js";
import type {HostLogger} from "../models/index.js";
import type {GzacApiCallContext} from "./gzac-api.js";
import {createKvHostFunction} from "./kv";

function noopLogger(): HostLogger {
  const l: HostLogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    child: () => l,
  };
  return l;
}

const baseCtx: GzacApiCallContext = {
  configurationId: "cfg-1",
  pluginId: "case-summary",
  pluginVersion: "0.1.0",
  serviceToken: "service-token-abc",
  gzacBaseUrl: "http://gzac:8080",
  grantedCapabilities: ["kv"],
};

let repo: {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
  deleteAll: ReturnType<typeof vi.fn>;
};

/** Drives the `kv` host function with a fake Extism CallContext and returns the plugin's reply. */
async function invoke(
  request: unknown,
  {ctx = baseCtx, noContext = false}: {ctx?: GzacApiCallContext; noContext?: boolean} = {}
) {
  const stored: string[] = [];
  const inputJson = typeof request === "string" ? request : JSON.stringify(request);
  const callContext = {
    hostContext: () => (noContext ? undefined : ctx),
    read: (_addr: bigint) => ({string: () => inputJson}),
    store: (s: string) => {
      stored.push(s);
      return 0n;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  const fn = createKvHostFunction(noopLogger(), repo as unknown as KvRepository);
  await fn(callContext, 0n);
  return JSON.parse(stored.at(-1)!);
}

describe("kv host function", () => {
  beforeEach(() => {
    repo = {
      get: vi.fn(async () => ({found: false, value: undefined})),
      set: vi.fn(async () => {}),
      delete: vi.fn(async () => false),
      list: vi.fn(async () => []),
      deleteAll: vi.fn(async () => {}),
    };
  });

  describe("capability gate", () => {
    it("returns 403 and touches no storage when the kv capability is not granted", async () => {
      const reply = await invoke(
        {op: "get", key: "a"},
        {ctx: {...baseCtx, grantedCapabilities: ["log"]}}
      );
      expect(reply).toEqual({
        status: 403,
        error: "Capability 'kv' not granted for this configuration",
      });
      expect(repo.get).not.toHaveBeenCalled();
    });

    it("denies a configuration pushed without any capabilities (no implicit grant)", async () => {
      const reply = await invoke({op: "list"}, {ctx: {...baseCtx, grantedCapabilities: []}});
      expect(reply.status).toBe(403);
      expect(repo.list).not.toHaveBeenCalled();
    });

    it("returns 500 when there is no invocation context", async () => {
      const reply = await invoke({op: "list"}, {noContext: true});
      expect(reply).toEqual({status: 500, error: "No active invocation context"});
      expect(repo.list).not.toHaveBeenCalled();
    });

    it("returns 400 for unparseable request JSON", async () => {
      const reply = await invoke("{nope");
      expect(reply.status).toBe(400);
      expect(reply.error).toContain("Invalid kv request JSON");
    });
  });

  describe("get", () => {
    it("returns the stored value with 200", async () => {
      repo.get.mockResolvedValue({found: true, value: {count: 3}});
      const reply = await invoke({op: "get", key: "view-count"});
      expect(reply).toEqual({status: 200, value: {count: 3}});
      expect(repo.get).toHaveBeenCalledWith("cfg-1", "view-count");
    });

    it("distinguishes a stored null from a missing key", async () => {
      repo.get.mockResolvedValue({found: true, value: null});
      expect(await invoke({op: "get", key: "k"})).toEqual({status: 200, value: null});
    });

    it("returns 404 for a missing key", async () => {
      repo.get.mockResolvedValue({found: false, value: undefined});
      expect(await invoke({op: "get", key: "missing"})).toEqual({status: 404});
    });

    it("returns 400 without a key", async () => {
      const reply = await invoke({op: "get"});
      expect(reply).toEqual({status: 400, error: "Missing 'key' for kv get"});
      expect(repo.get).not.toHaveBeenCalled();
    });
  });

  describe("set", () => {
    it("stores the value and returns 200", async () => {
      const reply = await invoke({op: "set", key: "view-count", value: 7});
      expect(reply).toEqual({status: 200});
      expect(repo.set).toHaveBeenCalledWith("cfg-1", "view-count", 7);
    });

    it("stores structured values verbatim", async () => {
      await invoke({op: "set", key: "state", value: {a: [1, 2], b: null}});
      expect(repo.set).toHaveBeenCalledWith("cfg-1", "state", {a: [1, 2], b: null});
    });

    it("returns 400 without a key", async () => {
      expect(await invoke({op: "set", value: 1})).toEqual({
        status: 400,
        error: "Missing 'key' for kv set",
      });
      expect(repo.set).not.toHaveBeenCalled();
    });

    it("accepts a 256-character key and rejects a longer one", async () => {
      expect(await invoke({op: "set", key: "k".repeat(256), value: 1})).toEqual({status: 200});

      const reply = await invoke({op: "set", key: "k".repeat(257), value: 1});
      expect(reply).toEqual({status: 400, error: "Key exceeds 256 characters"});
      expect(repo.set).toHaveBeenCalledTimes(1);
    });
  });

  describe("delete", () => {
    it("returns 200 when a row was removed", async () => {
      repo.delete.mockResolvedValue(true);
      expect(await invoke({op: "delete", key: "k"})).toEqual({status: 200});
      expect(repo.delete).toHaveBeenCalledWith("cfg-1", "k");
    });

    it("returns 404 when there was nothing to remove", async () => {
      repo.delete.mockResolvedValue(false);
      expect(await invoke({op: "delete", key: "k"})).toEqual({status: 404});
    });

    it("returns 400 without a key", async () => {
      expect(await invoke({op: "delete"})).toEqual({
        status: 400,
        error: "Missing 'key' for kv delete",
      });
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  describe("list", () => {
    it("returns the keys", async () => {
      repo.list.mockResolvedValue(["a", "b"]);
      expect(await invoke({op: "list"})).toEqual({status: 200, keys: ["a", "b"]});
      expect(repo.list).toHaveBeenCalledWith("cfg-1", undefined);
    });

    it("forwards a prefix verbatim", async () => {
      repo.list.mockResolvedValue(["user:1"]);
      await invoke({op: "list", prefix: "user:"});
      expect(repo.list).toHaveBeenCalledWith("cfg-1", "user:");
    });
  });

  describe("errors and scoping", () => {
    it("returns 400 for an unknown op, echoing it", async () => {
      const reply = await invoke({op: "increment", key: "k"});
      expect(reply).toEqual({status: 400, error: "Unknown kv op: increment"});
    });

    it("returns 400 when the op is absent", async () => {
      expect((await invoke({key: "k"})).status).toBe(400);
    });

    it("maps a storage failure to 500 carrying the message", async () => {
      repo.get.mockRejectedValue(new Error("connection terminated"));
      const reply = await invoke({op: "get", key: "k"});
      expect(reply).toEqual({status: 500, error: "kv operation failed: connection terminated"});
    });

    it("scopes every operation to the host context's configuration, never a plugin-supplied id", async () => {
      // A plugin cannot reach another configuration's namespace by naming it in the payload.
      repo.get.mockResolvedValue({found: true, value: 1});
      await invoke({op: "get", key: "k", configurationId: "cfg-victim"});
      expect(repo.get).toHaveBeenCalledWith("cfg-1", "k");

      await invoke({op: "set", key: "k", value: 1, configurationId: "cfg-victim"});
      expect(repo.set).toHaveBeenCalledWith("cfg-1", "k", 1);

      await invoke({op: "list", configurationId: "cfg-victim"});
      expect(repo.list).toHaveBeenCalledWith("cfg-1", undefined);
    });
  });
});
