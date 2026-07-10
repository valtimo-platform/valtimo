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
import {pluginDataRoutes} from "./plugin-data";

const PLUGIN = "case-summary";
const VERSION = "0.1.0";
const DATA_URL = `/plugins/${PLUGIN}/${VERSION}/data`;

describe("plugin-data route", () => {
  let app: FastifyInstance;
  let pluginManager: { getManifest: ReturnType<typeof vi.fn>; callRequest: ReturnType<typeof vi.fn> };
  let configRegistry: { get: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    pluginManager = {
      getManifest: vi.fn(() => ({})),
      callRequest: vi.fn(async () => ({ status: 200, body: { ok: true } })),
    };
    configRegistry = {
      get: vi.fn(async () => ({
        properties: { p: 1 },
        serviceToken: "svc-token",
        gzacBaseUrl: "http://gzac:8080",
      })),
    };
    app = await buildTestApp((a) =>
      pluginDataRoutes(a, {
        pluginManager: pluginManager as never,
        configRegistry: configRegistry as never,
        config: testConfig(),
      })
    );
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

  it("is PUBLIC for this iteration: a request with no HMAC/auth still executes (plan §7/§14)", async () => {
    const res = await app.inject({
      method: "POST",
      url: DATA_URL,
      payload: { method: "GET", path: "/summary" },
    });
    // ⚠️ Intentionally pins current behaviour. When /data is auth/capability-gated (roadmap #1),
    // this expectation must flip to 401/403.
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
        userToken: "user-tok",
      })
    );
  });

  it("passes an empty configuration and no token when configurationId is absent", async () => {
    await app.inject({
      method: "POST",
      url: DATA_URL,
      payload: { method: "GET", path: "/summary" },
    });
    expect(configRegistry.get).not.toHaveBeenCalled();
    expect(pluginManager.callRequest).toHaveBeenCalledWith(
      PLUGIN,
      VERSION,
      expect.objectContaining({ configuration: {}, serviceToken: undefined, gzacBaseUrl: undefined })
    );
  });

  it("returns 404 when the plugin is not loaded", async () => {
    pluginManager.getManifest.mockReturnValueOnce(null);
    const res = await app.inject({ method: "POST", url: DATA_URL, payload: { method: "GET", path: "/x" } });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 when method or path is missing", async () => {
    const res = await app.inject({ method: "POST", url: DATA_URL, payload: { path: "/x" } });
    expect(res.statusCode).toBe(400);
  });

  it("forwards the status and headers the plugin returns", async () => {
    pluginManager.callRequest.mockResolvedValueOnce({
      status: 201,
      headers: { "x-custom": "yes" },
      body: { created: true },
    });
    const res = await app.inject({ method: "POST", url: DATA_URL, payload: { method: "POST", path: "/x" } });
    expect(res.statusCode).toBe(201);
    expect(res.headers["x-custom"]).toBe("yes");
  });

  it("returns 500 when the plugin request handler throws", async () => {
    pluginManager.callRequest.mockRejectedValueOnce(new Error("handler exploded"));
    const res = await app.inject({ method: "POST", url: DATA_URL, payload: { method: "GET", path: "/x" } });
    expect(res.statusCode).toBe(500);
  });
});
