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

import {cpSync, mkdirSync, mkdtempSync, rmSync} from "node:fs";
import {createServer, type Server} from "node:http";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import type {HostLogger} from "../../src/models/index.js";
import {PluginManager} from "../../src/plugin-manager.js";
import {FIXTURE_MANIFEST, FIXTURE_PLUGIN_ID, FIXTURE_VERSION, FIXTURE_WASM, NODE_MAJOR,} from "./fixture.js";

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

/** A throwaway HTTP server standing in for the GZAC instance the gzac_api callback targets. */
function startGzacStub(): Promise<{ server: Server; baseUrl: string; lastAuth: () => string | undefined }> {
  let lastAuth: string | undefined;
  const server = createServer((req, res) => {
    lastAuth = req.headers["authorization"] as string | undefined;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ echoedPath: req.url }));
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}`, lastAuth: () => lastAuth });
    });
  });
}

/**
 * Stubs for the manager's persistence collaborators. The config provider grants every capability
 * (and no endpoint list — "older push", so gzac_api is not allowlist-restricted) so the fixture's
 * handlers can exercise the host functions.
 */
const configProviderStub = {
  get: async (configurationId: string) => ({
    configurationId,
    pluginId: FIXTURE_PLUGIN_ID,
    pluginVersion: FIXTURE_VERSION,
    properties: {},
    serviceToken: "svc-token-123",
    gzacBaseUrl: "http://gzac.invalid",
    eventSubscriptions: [],
    grantedCapabilities: ["gzac_api", "http_request", "kv", "log"],
  }),
};

const kvStore = new Map<string, unknown>();
const kvRepositoryStub = {
  get: async (configId: string, key: string) => {
    const found = kvStore.has(`${configId}:${key}`);
    return { found, value: found ? kvStore.get(`${configId}:${key}`) : undefined };
  },
  set: async (configId: string, key: string, value: unknown) => {
    kvStore.set(`${configId}:${key}`, value);
  },
  delete: async (configId: string, key: string) => kvStore.delete(`${configId}:${key}`),
  list: async () => [] as string[],
};

const logRepositoryStub = {
  insert: async () => {},
};

// Extism `runInWorker: true` (which PluginManager hardcodes for async host functions) needs Node 22.
describe.skipIf(NODE_MAJOR < 22)("PluginManager on compiled Wasm (runInWorker)", () => {
  let storageDir: string;
  let manager: PluginManager;

  beforeAll(async () => {
    storageDir = mkdtempSync(join(tmpdir(), "plugin-host-storage-"));
    const pluginDir = join(storageDir, FIXTURE_PLUGIN_ID, FIXTURE_VERSION);
    mkdirSync(pluginDir, { recursive: true });
    cpSync(FIXTURE_WASM, join(pluginDir, "plugin.wasm"));
    cpSync(FIXTURE_MANIFEST, join(pluginDir, "manifest.json"));

    manager = new PluginManager(
      storageDir,
      noopLogger(),
      configProviderStub as never,
      kvRepositoryStub as never,
      logRepositoryStub as never
    );
    await manager.loadPlugin(FIXTURE_PLUGIN_ID, FIXTURE_VERSION);
  });

  afterAll(async () => {
    await manager?.unloadPlugin(FIXTURE_PLUGIN_ID, FIXTURE_VERSION);
    await manager?.close();
    if (storageDir) rmSync(storageDir, { recursive: true, force: true });
  });

  const actionCall = (overrides: Record<string, unknown> = {}) => ({
    configurationId: "cfg-1",
    configuration: { greeting: "hi" },
    processInstanceId: "pi",
    documentId: "doc",
    activityId: "act",
    properties: {},
    serviceToken: "svc-token-123",
    gzacBaseUrl: "http://gzac.invalid",
    ...overrides,
  });

  it("runs an action and returns its variables", async () => {
    const out = await manager.callAction(FIXTURE_PLUGIN_ID, FIXTURE_VERSION, "echo", actionCall());
    expect(out.status).toBe("completed");
    expect((out.variables as { configFromAccessor: unknown }).configFromAccessor).toEqual({ greeting: "hi" });
  });

  it("does not serialize the service token / gzacBaseUrl into the Wasm input (host-context secrecy)", async () => {
    const out = await manager.callAction(FIXTURE_PLUGIN_ID, FIXTURE_VERSION, "echo", actionCall());
    const variables = out.variables as { inputKeys: string[]; input: Record<string, unknown> };
    expect(variables.inputKeys).not.toContain("serviceToken");
    expect(variables.inputKeys).not.toContain("gzacBaseUrl");
    expect(variables.input).not.toHaveProperty("serviceToken");
    expect(variables.input).not.toHaveProperty("gzacBaseUrl");
  });

  it("threads the service token through the host context to the gzac_api callback", async () => {
    const gzac = await startGzacStub();
    try {
      const out = await manager.callAction(
        FIXTURE_PLUGIN_ID,
        FIXTURE_VERSION,
        "call-gzac",
        actionCall({ serviceToken: "svc-token-123", gzacBaseUrl: gzac.baseUrl })
      );
      expect(out.status).toBe("completed");
      const variables = out.variables as { gzacStatus: number; gzacBody: { echoedPath: string } };
      expect(variables.gzacStatus).toBe(200);
      expect(variables.gzacBody.echoedPath).toBe("/api/v1/echo");
      // The token rode in the per-call host context and was attached by the host function, never by
      // the plugin (which cannot see it).
      expect(gzac.lastAuth()).toBe("Bearer svc-token-123");
    } finally {
      gzac.server.close();
    }
  });

  it("delivers an event to handle_event", async () => {
    const out = await manager.callEvent(FIXTURE_PLUGIN_ID, FIXTURE_VERSION, {
      configurationId: "cfg-1",
      configuration: {},
      event: { type: "test.event.handled", id: "e", source: "s" },
      serviceToken: "svc-token-123",
      gzacBaseUrl: "http://gzac.invalid",
    });
    expect(out.status).toBe("completed");
  });

  it("serves a data request via handle_request", async () => {
    const out = await manager.callRequest(FIXTURE_PLUGIN_ID, FIXTURE_VERSION, {
      configurationId: "cfg-1",
      configuration: { c: 1 },
      method: "GET",
      path: "/echo",
      query: { a: "b" },
      userToken: "user-token",
    });
    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({ path: "/echo", method: "GET", query: { a: "b" } });
  });

  it("handles concurrent calls without an Extism reentrancy error", async () => {
    // A single Extism instance is not reentrant, so these would hit "plugin is not reentrant" if
    // they shared one; the pool gives each concurrent call its own instance and each returns its
    // own echoed documentId.
    const calls = Array.from({ length: 8 }, (_, i) =>
      manager.callAction(FIXTURE_PLUGIN_ID, FIXTURE_VERSION, "echo", actionCall({ documentId: `doc-${i}` }))
    );
    const results = await Promise.all(calls);
    const seenDocIds = results.map((r) => (r.variables as { input: { documentId: string } }).input.documentId);
    expect(results.every((r) => r.status === "completed")).toBe(true);
    expect(new Set(seenDocIds)).toEqual(new Set(Array.from({ length: 8 }, (_, i) => `doc-${i}`)));
  });

  it("throws for an unknown plugin/version", async () => {
    await expect(manager.callAction("ghost", "9.9.9", "echo", actionCall())).rejects.toThrow(/not found/i);
  });

  it("cancels a stuck plugin call at wasmTimeoutMs and recovers on the next call", async () => {
    // A dedicated manager with a short timeout so the spinning fixture handler is cancelled fast.
    const timeoutManager = new PluginManager(
      storageDir,
      noopLogger(),
      configProviderStub as never,
      kvRepositoryStub as never,
      logRepositoryStub as never,
      { wasmTimeoutMs: 1_000 }
    );
    try {
      await timeoutManager.loadPlugin(FIXTURE_PLUGIN_ID, FIXTURE_VERSION);
      await expect(
        timeoutManager.callAction(FIXTURE_PLUGIN_ID, FIXTURE_VERSION, "spin", actionCall())
      ).rejects.toThrow(/timed out after 1000ms/);
      // The stale instance was dropped; a fresh call works again.
      const out = await timeoutManager.callAction(FIXTURE_PLUGIN_ID, FIXTURE_VERSION, "echo", actionCall());
      expect(out.status).toBe("completed");
    } finally {
      await timeoutManager.close();
    }
  }, 30_000);

  /**
   * #611: the pool is what makes two calls to one plugin overlap. The `burn` handler busy-waits in
   * QuickJS, so wall-clock time is the only honest way to tell parallel execution from queued
   * execution — hence the deliberately wide margins.
   */
  describe("instance pool", () => {
    const BURN_MS = 1_500;

    const burn = () => actionCall({ properties: { ms: BURN_MS } });

    async function timeTwoBurns(poolMaxInstances: number): Promise<number> {
      const pooled = new PluginManager(
        storageDir,
        noopLogger(),
        configProviderStub as never,
        kvRepositoryStub as never,
        logRepositoryStub as never,
        { poolMaxInstances, wasmTimeoutMs: 20_000 }
      );
      try {
        await pooled.loadPlugin(FIXTURE_PLUGIN_ID, FIXTURE_VERSION);
        // Warm both instances first, so instantiation cost is not counted as execution time.
        await Promise.all([
          pooled.callAction(FIXTURE_PLUGIN_ID, FIXTURE_VERSION, "echo", actionCall()),
          pooled.callAction(FIXTURE_PLUGIN_ID, FIXTURE_VERSION, "echo", actionCall()),
        ]);

        const started = Date.now();
        const results = await Promise.all([
          pooled.callAction(FIXTURE_PLUGIN_ID, FIXTURE_VERSION, "burn", burn()),
          pooled.callAction(FIXTURE_PLUGIN_ID, FIXTURE_VERSION, "burn", burn()),
        ]);
        const elapsed = Date.now() - started;
        expect(results.every((r) => r.status === "completed")).toBe(true);
        return elapsed;
      } finally {
        await pooled.close();
      }
    }

    it("runs two calls to the same plugin in parallel", async () => {
      const elapsed = await timeTwoBurns(2);
      // Two 1.5 s calls finishing well inside 3 s can only mean they overlapped.
      expect(elapsed).toBeLessThan(2 * BURN_MS);
    }, 60_000);

    it("serialises the same pair when the pool maximum is 1", async () => {
      // The documented contrast: WASM_POOL_MAX_INSTANCES=1 restores strictly serialised calls.
      const elapsed = await timeTwoBurns(1);
      expect(elapsed).toBeGreaterThanOrEqual(2 * BURN_MS);
    }, 60_000);
  });

  /**
   * #612: Extism's own `maxPages` option bounds only the host-side blocks used to pass input and
   * output across the boundary — the guest declares and exports its own linear memory. The host
   * writes the cap into the module's memory declaration instead, which is what actually stops
   * QuickJS's heap from growing past it.
   */
  describe("memory cap", () => {
    /** Runs `mem-bomb` under a given page cap, folding a host rejection into the same shape. */
    async function memBomb(wasmMaxMemoryPages: number, chunks: number) {
      const capped = new PluginManager(
        storageDir,
        noopLogger(),
        configProviderStub as never,
        kvRepositoryStub as never,
        logRepositoryStub as never,
        // The wall-clock timeout is deliberately generous, so a failure here proves the *memory*
        // cap fired rather than the timeout.
        { wasmMaxMemoryPages, wasmTimeoutMs: 25_000 }
      );
      try {
        await capped.loadPlugin(FIXTURE_PLUGIN_ID, FIXTURE_VERSION);
        const out = await capped
          .callAction(FIXTURE_PLUGIN_ID, FIXTURE_VERSION, "mem-bomb", actionCall({ properties: { chunks } }))
          .catch((err: Error) => ({ status: "host-rejected", errorMessage: err.message }));
        // The host served the memory bomb without dying: the next call still succeeds.
        const after = await capped.callAction(FIXTURE_PLUGIN_ID, FIXTURE_VERSION, "echo", actionCall());
        expect(after.status).toBe("completed");
        return out;
      } finally {
        await capped.close();
      }
    }

    it("fails an allocation past the cap and keeps serving the next call", async () => {
      // 512 pages = 32 MiB; 4000 chunks of 256 KiB ≈ 1 GiB. Documented real behaviour: the cap in
      // the module's memory declaration makes `memory.grow` fail, QuickJS's allocator reports out
      // of memory, and the SDK runtime returns its EXECUTION_ERROR envelope — a contained failure
      // rather than a host crash or a 400 MiB resident process.
      const out = await memBomb(512, 4000);
      expect(out).toMatchObject({ status: "error", errorCode: "EXECUTION_ERROR" });
      expect((out as { errorMessage: string }).errorMessage).toMatch(/out of memory/i);
    }, 60_000);

    it("still runs an allocation that fits inside the cap", async () => {
      // Guards the test above against a false pass: if `mem-bomb` were missing or broken, the
      // failing assertion would look like the cap working.
      const out = await memBomb(512, 40); // ~10 MiB, comfortably under 32 MiB
      expect(out).toMatchObject({ status: "completed", variables: { allocated: 40 } });
    }, 60_000);

    it("lets the same allocation through when the cap is disabled", async () => {
      const out = await memBomb(0, 40);
      expect(out).toMatchObject({ status: "completed" });
    }, 60_000);
  });
});
