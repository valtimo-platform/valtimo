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

    manager = new PluginManager(storageDir, noopLogger());
    await manager.loadPlugin(FIXTURE_PLUGIN_ID, FIXTURE_VERSION);
  });

  afterAll(async () => {
    await manager?.unloadPlugin(FIXTURE_PLUGIN_ID, FIXTURE_VERSION);
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

  it("serializes concurrent calls to one instance without an Extism reentrancy error", async () => {
    // Without runExclusive these would hit "plugin is not reentrant"; with it they queue and each
    // returns its own echoed documentId.
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
});
