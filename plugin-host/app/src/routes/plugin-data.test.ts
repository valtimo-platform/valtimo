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

import type {FastifyInstance} from "fastify";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {buildTestApp, testConfig} from "../test-support/harness";
import {UserTokenIntrospector} from "../security/user-token-introspection";
import {pluginDataRoutes} from "./plugin-data";

const PLUGIN = "case-summary";
const VERSION = "0.1.0";
const DATA_URL = `/plugins/${PLUGIN}/${VERSION}/data`;

describe("plugin-data route", () => {
  let app: FastifyInstance;
  let pluginManager: { getManifest: ReturnType<typeof vi.fn>; callRequest: ReturnType<typeof vi.fn> };
  let configRegistry: { get: ReturnType<typeof vi.fn> };
  let introspector: { introspect: ReturnType<typeof vi.fn> };

  async function buildApp(rateLimitPerMinute = 120): Promise<void> {
    app = await buildTestApp((a) =>
      pluginDataRoutes(a, {
        pluginManager: pluginManager as never,
        configRegistry: configRegistry as never,
        config: testConfig({ DATA_RATE_LIMIT_PER_MINUTE: rateLimitPerMinute }),
        userTokenIntrospector: introspector as unknown as UserTokenIntrospector,
      })
    );
  }

  beforeEach(async () => {
    pluginManager = {
      getManifest: vi.fn(() => ({})),
      callRequest: vi.fn(async () => ({ status: 200, body: { ok: true } })),
    };
    configRegistry = {
      get: vi.fn(async () => ({
        pluginId: PLUGIN,
        pluginVersion: VERSION,
        properties: { p: 1 },
        serviceToken: "svc-token",
        gzacBaseUrl: "http://gzac:8080",
        grantedCapabilities: ["gzac_api", "frontend_data"],
      })),
    };
    introspector = {
      introspect: vi.fn(async () => ({ kind: "valid", configurationId: "cfg-1" })),
    };
    await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("answers the CORS preflight with 204 and permissive headers", async () => {
    const res = await app.inject({ method: "OPTIONS", url: DATA_URL });
    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("*");
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
  });

  it("executes for a configuration granted the frontend_data capability", async () => {
    const res = await app.inject({
      method: "POST",
      url: DATA_URL,
      payload: { configurationId: "cfg-1", method: "GET", path: "/summary", userToken: "user-tok" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });

  it("looks up the config and forwards its token context + the user token to the plugin", async () => {
    await app.inject({
      method: "POST",
      url: DATA_URL,
      payload: {
        configurationId: "cfg-1",
        method: "POST",
        path: "/summary",
        query: { docId: "42" },
        body: { q: 1 },
        context: { documentId: "doc-1" },
        userToken: "user-tok",
      },
    });

    expect(pluginManager.callRequest).toHaveBeenCalledWith(
      PLUGIN,
      VERSION,
      expect.objectContaining({
        configurationId: "cfg-1",
        configuration: { p: 1 },
        method: "POST",
        path: "/summary",
        query: { docId: "42" },
        body: { q: 1 },
        context: { documentId: "doc-1" },
        serviceToken: "svc-token",
        gzacBaseUrl: "http://gzac:8080",
        // Introspected against GZAC before the call, then forwarded so the handler can use
        // gzacApi.asUser (GZAC re-verifies it on every as:"user" callback).
        userToken: "user-tok",
      })
    );
  });

  it("returns 400 when configurationId is absent (Wasm never runs)", async () => {
    const res = await app.inject({
      method: "POST",
      url: DATA_URL,
      payload: { method: "GET", path: "/summary", userToken: "user-tok" },
    });
    expect(res.statusCode).toBe(400);
    expect(pluginManager.callRequest).not.toHaveBeenCalled();
  });

  it("returns 400 when userToken is absent (Wasm never runs, no introspection)", async () => {
    const res = await app.inject({
      method: "POST",
      url: DATA_URL,
      payload: { configurationId: "cfg-1", method: "GET", path: "/summary" },
    });
    expect(res.statusCode).toBe(400);
    expect(introspector.introspect).not.toHaveBeenCalled();
    expect(pluginManager.callRequest).not.toHaveBeenCalled();
  });

  it("returns 401 when GZAC rejects the user token (Wasm never runs)", async () => {
    introspector.introspect.mockResolvedValueOnce({ kind: "invalid" });
    const res = await app.inject({
      method: "POST",
      url: DATA_URL,
      payload: { configurationId: "cfg-1", method: "GET", path: "/x", userToken: "forged" },
    });
    expect(res.statusCode).toBe(401);
    expect(pluginManager.callRequest).not.toHaveBeenCalled();
  });

  it("returns 403 when the token is bound to a different configuration (Wasm never runs)", async () => {
    introspector.introspect.mockResolvedValueOnce({ kind: "valid", configurationId: "cfg-OTHER" });
    const res = await app.inject({
      method: "POST",
      url: DATA_URL,
      payload: { configurationId: "cfg-1", method: "GET", path: "/x", userToken: "user-tok" },
    });
    expect(res.statusCode).toBe(403);
    expect(pluginManager.callRequest).not.toHaveBeenCalled();
  });

  it("returns 503 when GZAC is unreachable — fail closed, Wasm never runs", async () => {
    introspector.introspect.mockResolvedValueOnce({ kind: "unavailable" });
    const res = await app.inject({
      method: "POST",
      url: DATA_URL,
      payload: { configurationId: "cfg-1", method: "GET", path: "/x", userToken: "user-tok" },
    });
    expect(res.statusCode).toBe(503);
    expect(pluginManager.callRequest).not.toHaveBeenCalled();
  });

  it("introspects against the configuration's own GZAC base URL", async () => {
    await app.inject({
      method: "POST",
      url: DATA_URL,
      payload: { configurationId: "cfg-1", method: "GET", path: "/x", userToken: "user-tok" },
    });
    expect(introspector.introspect).toHaveBeenCalledWith("http://gzac:8080", "user-tok");
  });

  it("returns 403 for an unknown configuration (Wasm never runs)", async () => {
    configRegistry.get.mockResolvedValueOnce(undefined);
    const res = await app.inject({
      method: "POST",
      url: DATA_URL,
      payload: { configurationId: "ghost", method: "GET", path: "/x", userToken: "user-tok" },
    });
    expect(res.statusCode).toBe(403);
    expect(pluginManager.callRequest).not.toHaveBeenCalled();
  });

  it("returns 403 when the configuration lacks the frontend_data capability", async () => {
    configRegistry.get.mockResolvedValueOnce({
      pluginId: PLUGIN,
      pluginVersion: VERSION,
      properties: {},
      serviceToken: "svc-token",
      gzacBaseUrl: "http://gzac:8080",
      grantedCapabilities: ["gzac_api"],
    });
    const res = await app.inject({
      method: "POST",
      url: DATA_URL,
      payload: { configurationId: "cfg-1", method: "GET", path: "/x", userToken: "user-tok" },
    });
    expect(res.statusCode).toBe(403);
    expect(pluginManager.callRequest).not.toHaveBeenCalled();
  });

  it("returns 403 when the configuration targets a different plugin version", async () => {
    configRegistry.get.mockResolvedValueOnce({
      pluginId: PLUGIN,
      pluginVersion: "9.9.9",
      properties: {},
      serviceToken: "svc-token",
      gzacBaseUrl: "http://gzac:8080",
      grantedCapabilities: ["frontend_data"],
    });
    const res = await app.inject({
      method: "POST",
      url: DATA_URL,
      payload: { configurationId: "cfg-1", method: "GET", path: "/x", userToken: "user-tok" },
    });
    expect(res.statusCode).toBe(403);
    expect(pluginManager.callRequest).not.toHaveBeenCalled();
  });

  it("rate-limits per configuration with 429 once the per-minute budget is spent", async () => {
    await app.close();
    await buildApp(2);
    const post = () =>
      app.inject({
        method: "POST",
        url: DATA_URL,
        payload: { configurationId: "cfg-1", method: "GET", path: "/x", userToken: "user-tok" },
      });
    expect((await post()).statusCode).toBe(200);
    expect((await post()).statusCode).toBe(200);
    expect((await post()).statusCode).toBe(429);
  });

  it("returns 404 when the plugin is not loaded", async () => {
    pluginManager.getManifest.mockReturnValueOnce(null);
    const res = await app.inject({
      method: "POST",
      url: DATA_URL,
      payload: { configurationId: "cfg-1", method: "GET", path: "/x", userToken: "user-tok" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 when method or path is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: DATA_URL,
      payload: { configurationId: "cfg-1", path: "/x", userToken: "user-tok" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("forwards the status and headers the plugin returns", async () => {
    pluginManager.callRequest.mockResolvedValueOnce({
      status: 201,
      headers: { "x-custom": "yes" },
      body: { created: true },
    });
    const res = await app.inject({
      method: "POST",
      url: DATA_URL,
      payload: { configurationId: "cfg-1", method: "POST", path: "/x", userToken: "user-tok" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.headers["x-custom"]).toBe("yes");
  });

  it("serves a second call from the introspection cache — one GZAC round-trip", async () => {
    // Real introspector, stubbed network: proves the route + cache wiring end-to-end.
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            subject: "john@example.com",
            configurationId: "cfg-1",
            expiresAt: new Date(Date.now() + 900_000).toISOString(),
          }),
          { status: 200 }
        )
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      await app.close();
      introspector = new UserTokenIntrospector() as never;
      await buildApp();

      const post = () =>
        app.inject({
          method: "POST",
          url: DATA_URL,
          payload: { configurationId: "cfg-1", method: "GET", path: "/x", userToken: "user-tok" },
        });
      expect((await post()).statusCode).toBe(200);
      expect((await post()).statusCode).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("returns 500 when the plugin request handler throws", async () => {
    pluginManager.callRequest.mockRejectedValueOnce(new Error("handler exploded"));
    const res = await app.inject({
      method: "POST",
      url: DATA_URL,
      payload: { configurationId: "cfg-1", method: "GET", path: "/x", userToken: "user-tok" },
    });
    expect(res.statusCode).toBe(500);
  });
});
