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
import {buildTestApp, signHeaders, testConfig} from "../test-support/harness";
import {pluginActionRoutes} from "./plugin-actions";

const PLUGIN = "case-summary";
const VERSION = "0.1.0";
const ACTION = "my-action";

describe("plugin-actions routes", () => {
  let app: FastifyInstance;
  let pluginManager: { getManifest: ReturnType<typeof vi.fn>; callAction: ReturnType<typeof vi.fn> };
  let configRegistry: { get: ReturnType<typeof vi.fn> };

  const storedConfig = () => ({
    configurationId: "cfg-1",
    pluginId: PLUGIN,
    pluginVersion: VERSION,
    properties: { setting: "x" },
    serviceToken: "svc-token",
    gzacBaseUrl: "http://gzac:8080",
    eventSubscriptions: [],
  });

  beforeEach(async () => {
    pluginManager = {
      getManifest: vi.fn(() => ({ actions: [{ key: ACTION }] })),
      callAction: vi.fn(async () => ({ status: "completed", variables: { done: true } })),
    };
    configRegistry = { get: vi.fn(async () => storedConfig()) };
    app = await buildTestApp((a) =>
      pluginActionRoutes(a, {
        pluginManager: pluginManager as never,
        configRegistry: configRegistry as never,
        config: testConfig(),
      })
    );
  });

  afterEach(async () => {
    await app.close();
  });

  function invokeAction(body: unknown, secret?: string) {
    const path = `/plugins/${PLUGIN}/${VERSION}/actions/${ACTION}`;
    const payload = JSON.stringify(body);
    return app.inject({
      method: "POST",
      url: path,
      headers: { "content-type": "application/json", ...signHeaders("POST", path, payload, secret) },
      payload,
    });
  }

  const actionBody = (overrides: Record<string, unknown> = {}) => ({
    configurationId: "cfg-1",
    processInstanceId: "pi-1",
    documentId: "doc-1",
    activityId: "act-1",
    properties: { a: 1 },
    ...overrides,
  });

  it("invokes the action and returns 200 with the variables", async () => {
    const res = await invokeAction(actionBody());
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "completed", variables: { done: true } });
    expect(pluginManager.callAction).toHaveBeenCalledWith(
      PLUGIN,
      VERSION,
      ACTION,
      expect.objectContaining({
        configurationId: "cfg-1",
        configuration: { setting: "x" },
        processInstanceId: "pi-1",
        documentId: "doc-1",
        activityId: "act-1",
        properties: { a: 1 },
        serviceToken: "svc-token",
        gzacBaseUrl: "http://gzac:8080",
      })
    );
  });

  it("maps a plugin-level error result to 422 (catchable as a BPMN error)", async () => {
    pluginManager.callAction.mockResolvedValueOnce({
      status: "error",
      errorCode: "BOOM",
      errorMessage: "nope",
    });
    const res = await invokeAction(actionBody());
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ status: "error", errorCode: "BOOM" });
  });

  it("returns 500 when callAction throws (host/infrastructure error)", async () => {
    pluginManager.callAction.mockRejectedValueOnce(new Error("wasm crash"));
    const res = await invokeAction(actionBody());
    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ status: "error", errorCode: "HOST_ERROR" });
  });

  it("returns 404 when the plugin is not loaded", async () => {
    pluginManager.getManifest.mockReturnValueOnce(null);
    expect((await invokeAction(actionBody())).statusCode).toBe(404);
  });

  it("returns 404 when the action key is unknown", async () => {
    pluginManager.getManifest.mockReturnValueOnce({ actions: [{ key: "other" }] });
    expect((await invokeAction(actionBody())).statusCode).toBe(404);
  });

  it("returns 400 when configurationId is missing", async () => {
    const res = await invokeAction(actionBody({ configurationId: "" }));
    expect(res.statusCode).toBe(400);
    expect(pluginManager.callAction).not.toHaveBeenCalled();
  });

  it("returns 404 when the configuration is not in the registry", async () => {
    configRegistry.get.mockResolvedValueOnce(undefined);
    expect((await invokeAction(actionBody())).statusCode).toBe(404);
  });

  it("returns 400 when the configuration targets a different plugin/version", async () => {
    configRegistry.get.mockResolvedValueOnce({ ...storedConfig(), pluginVersion: "9.9.9" });
    expect((await invokeAction(actionBody())).statusCode).toBe(400);
  });

  it("returns 500 when the configuration is missing callback context", async () => {
    configRegistry.get.mockResolvedValueOnce({ ...storedConfig(), serviceToken: "", gzacBaseUrl: "" });
    const res = await invokeAction(actionBody());
    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ errorCode: "MISSING_CALLBACK_CONTEXT" });
  });

  it("returns 401 for an unsigned action call", async () => {
    const path = `/plugins/${PLUGIN}/${VERSION}/actions/${ACTION}`;
    const res = await app.inject({
      method: "POST",
      url: path,
      headers: { "content-type": "application/json" },
      payload: JSON.stringify(actionBody()),
    });
    expect(res.statusCode).toBe(401);
    expect(pluginManager.callAction).not.toHaveBeenCalled();
  });

  describe("GET plugin-manifest (public)", () => {
    it("serves the manifest with a permissive CORS header", async () => {
      const res = await app.inject({ method: "GET", url: `/plugins/${PLUGIN}/${VERSION}/plugin-manifest` });
      expect(res.statusCode).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe("*");
    });

    it("returns 404 when the plugin is not loaded", async () => {
      pluginManager.getManifest.mockReturnValueOnce(null);
      const res = await app.inject({ method: "GET", url: `/plugins/${PLUGIN}/${VERSION}/plugin-manifest` });
      expect(res.statusCode).toBe(404);
    });
  });
});
