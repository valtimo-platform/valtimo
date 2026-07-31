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
 * L1 tests for the PluginManager's *wiring* around Extism: the execution-limit options passed to
 * `createPlugin`, timeout error mapping, grant plumbing into the per-call host context, the
 * unload-vs-in-flight-call lock, and idle-instance eviction. The real Wasm behaviour is covered by
 * the L3 suite (`test/wasm/`), which needs the extism-js toolchain.
 */

import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {HostLogger} from "./models/index.js";

const createPluginMock = vi.fn();
vi.mock("@extism/extism", () => ({
  default: (...args: unknown[]) => createPluginMock(...args),
}));

// Import AFTER the mock so plugin-manager picks it up.
const {PluginManager} = await import("./plugin-manager.js");

const PLUGIN_ID = "test-plugin";
const VERSION = "1.0.0";

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

function fakeExtismPlugin() {
  return {
    call: vi.fn(async () => ({ text: () => JSON.stringify({ status: "completed" }) })),
    close: vi.fn(async () => {}),
  };
}

const configProvider = {
  get: vi.fn(async () => ({
    configurationId: "cfg-1",
    pluginId: PLUGIN_ID,
    pluginVersion: VERSION,
    properties: {},
    serviceToken: "svc",
    gzacBaseUrl: "http://gzac:8080",
    eventSubscriptions: [],
    grantedCapabilities: ["gzac_api"],
    grantedEndpoints: [{ method: "GET", pattern: "/api/v1/document/*" }],
  })),
};

const stubRepos = { kv: {} as never, log: {} as never };

const actionInput = {
  configurationId: "cfg-1",
  configuration: {},
  processInstanceId: "p",
  documentId: "d",
  activityId: "a",
  properties: {},
  serviceToken: "svc",
  gzacBaseUrl: "http://gzac:8080",
};

describe("PluginManager (mocked Extism)", () => {
  let storageDir: string;
  let manager: InstanceType<typeof PluginManager>;

  function makeManager(options: ConstructorParameters<typeof PluginManager>[5] = {}) {
    return new PluginManager(
      storageDir,
      noopLogger(),
      configProvider as never,
      stubRepos.kv,
      stubRepos.log,
      options
    );
  }

  beforeEach(() => {
    createPluginMock.mockReset();
    createPluginMock.mockImplementation(async () => fakeExtismPlugin());
    configProvider.get.mockClear();
    storageDir = mkdtempSync(join(tmpdir(), "plugin-manager-test-"));
    const pluginDir = join(storageDir, PLUGIN_ID, VERSION);
    mkdirSync(pluginDir, { recursive: true });
    writeFileSync(
      join(pluginDir, "manifest.json"),
      JSON.stringify({
        pluginId: PLUGIN_ID,
        version: VERSION,
        translations: { en: { name: "Test", description: "d" } },
        actions: [],
      })
    );
    writeFileSync(join(pluginDir, "plugin.wasm"), Buffer.from([0x00, 0x61, 0x73, 0x6d]));
  });

  afterEach(async () => {
    await manager?.close();
    rmSync(storageDir, { recursive: true, force: true });
    vi.useRealTimers();
  });

  it("passes the configured timeout and memory cap to createPlugin", async () => {
    manager = makeManager({ wasmTimeoutMs: 12_345, wasmMaxMemoryPages: 512 });
    await manager.loadPlugin(PLUGIN_ID, VERSION);
    await manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput);

    expect(createPluginMock).toHaveBeenCalledOnce();
    const options = createPluginMock.mock.calls[0][1] as Record<string, unknown>;
    expect(options.timeoutMs).toBe(12_345);
    expect(options.memory).toEqual({ maxPages: 512 });
    expect(options.runInWorker).toBe(true);
  });

  it("defaults the limits and omits the memory cap when it is disabled (0)", async () => {
    manager = makeManager({ wasmMaxMemoryPages: 0 });
    await manager.loadPlugin(PLUGIN_ID, VERSION);
    await manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput);

    const options = createPluginMock.mock.calls[0][1] as Record<string, unknown>;
    expect(options.timeoutMs).toBe(30_000);
    expect(options.memory).toBeUndefined();
  });

  it("maps Extism's timeout cancellation to a clear error and drops the cached instance", async () => {
    manager = makeManager({ wasmTimeoutMs: 500 });
    await manager.loadPlugin(PLUGIN_ID, VERSION);
    const stuck = fakeExtismPlugin();
    stuck.call.mockRejectedValueOnce(new Error("EXTISM: call canceled due to timeout"));
    createPluginMock.mockResolvedValueOnce(stuck);

    await expect(
      manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput)
    ).rejects.toThrow(/timed out after 500ms/);
    // The stale worker was discarded…
    expect(stuck.close).toHaveBeenCalled();

    // …and the next call gets a fresh instance and succeeds.
    const result = await manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput);
    expect(result.status).toBe("completed");
    expect(createPluginMock).toHaveBeenCalledTimes(2);
  });

  it("threads the configuration's grants (capabilities + endpoints) into the per-call host context", async () => {
    manager = makeManager();
    await manager.loadPlugin(PLUGIN_ID, VERSION);
    const instance = fakeExtismPlugin();
    createPluginMock.mockResolvedValueOnce(instance);

    await manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput);

    const hostCtx = instance.call.mock.calls[0][2] as Record<string, unknown>;
    expect(hostCtx.grantedCapabilities).toEqual(["gzac_api"]);
    expect(hostCtx.grantedEndpoints).toEqual([{ method: "GET", pattern: "/api/v1/document/*" }]);
    expect(hostCtx.serviceToken).toBe("svc");
  });

  it("does not close an in-flight call's instance on unloadPlugin — it waits for the lock", async () => {
    manager = makeManager();
    await manager.loadPlugin(PLUGIN_ID, VERSION);

    const instance = fakeExtismPlugin();
    let finishCall!: () => void;
    let closedDuringCall = false;
    instance.call.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        finishCall = resolve;
      });
      closedDuringCall = instance.close.mock.calls.length > 0;
      return { text: () => JSON.stringify({ status: "completed" }) };
    });
    createPluginMock.mockResolvedValueOnce(instance);

    const inFlight = manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput);
    // Let the call reach the Extism instance, then race a delete against it.
    await vi.waitFor(() => expect(instance.call).toHaveBeenCalled());
    const unloading = manager.unloadPlugin(PLUGIN_ID, VERSION);

    finishCall();
    await expect(inFlight).resolves.toMatchObject({ status: "completed" });
    await unloading;

    expect(closedDuringCall).toBe(false);
    expect(instance.close).toHaveBeenCalled();
  });

  it("evicts an instance that has been idle past the TTL, via the periodic sweep", async () => {
    vi.useFakeTimers();
    manager = makeManager({ instanceIdleTtlMs: 1_000 });
    await manager.loadPlugin(PLUGIN_ID, VERSION);
    const instance = fakeExtismPlugin();
    createPluginMock.mockResolvedValueOnce(instance);

    await manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput);
    expect(instance.close).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2_500);
    expect(instance.close).toHaveBeenCalled();

    // The next call transparently re-instantiates.
    await manager.callAction(PLUGIN_ID, VERSION, "echo", actionInput);
    expect(createPluginMock).toHaveBeenCalledTimes(2);
  });
});
