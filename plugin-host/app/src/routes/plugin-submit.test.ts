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
import {resetReplayCacheForTests} from "../security/hmac-auth";
import {pluginSubmitRoutes} from "./plugin-submit";

const PLUGIN = "case-summary";
const VERSION = "0.1.0";
const SUBMIT_KEY = "review";

/**
 * The task-form Level 1 hook: GZAC calls this during a submission when the bundle
 * declares `submitHandler: true`. Same rails as the action route — HMAC-signed, service-token
 * context injected host-side — but GZAC, not the plugin, completes the task, so a plugin-level
 * rejection has to come back as a distinguishable 422 rather than an infrastructure error.
 */
describe("plugin-submit route", () => {
  let app: FastifyInstance;
  let pluginManager: {
    getManifest: ReturnType<typeof vi.fn>;
    callSubmit: ReturnType<typeof vi.fn>;
    getContentHash: ReturnType<typeof vi.fn>;
  };
  let configRegistry: {get: ReturnType<typeof vi.fn>};

  const storedConfig = (overrides: Record<string, unknown> = {}) => ({
    configurationId: "cfg-1",
    pluginId: PLUGIN,
    pluginVersion: VERSION,
    properties: {setting: "x"},
    serviceToken: "svc-token",
    gzacBaseUrl: "http://gzac:8080",
    eventSubscriptions: [],
    ...overrides,
  });

  beforeEach(async () => {
    resetReplayCacheForTests();
    pluginManager = {
      getManifest: vi.fn(() => ({
        frontendBundles: [{type: "task-form", key: SUBMIT_KEY, path: "/x", submitHandler: true}],
      })),
      callSubmit: vi.fn(async () => ({
        status: "completed",
        variables: {approved: true},
        documentContent: {"/reviewComment": "ok"},
      })),
      getContentHash: vi.fn(() => "sha256:pinned"),
    };
    configRegistry = {get: vi.fn(async () => storedConfig())};
    app = await buildTestApp((a) =>
      pluginSubmitRoutes(a, {
        pluginManager: pluginManager as never,
        configRegistry: configRegistry as never,
        config: testConfig(),
      })
    );
  });

  afterEach(async () => {
    await app.close();
  });

  function submit(body: unknown, {secret, key = SUBMIT_KEY}: {secret?: string; key?: string} = {}) {
    const path = `/plugins/${PLUGIN}/${VERSION}/submit/${key}`;
    const payload = JSON.stringify(body);
    return app.inject({
      method: "POST",
      url: path,
      headers: {"content-type": "application/json", ...signHeaders("POST", path, payload, secret)},
      payload,
    });
  }

  const submitBody = (overrides: Record<string, unknown> = {}) => ({
    configurationId: "cfg-1",
    taskId: "task-1",
    processInstanceId: "pi-1",
    documentId: "doc-1",
    submission: {"pv:approved": true, "doc:/reviewComment": "looks good"},
    ...overrides,
  });

  describe("authentication (HMAC)", () => {
    it("rejects an unsigned request with 401 and never runs the hook", async () => {
      const path = `/plugins/${PLUGIN}/${VERSION}/submit/${SUBMIT_KEY}`;
      const res = await app.inject({
        method: "POST",
        url: path,
        headers: {"content-type": "application/json"},
        payload: JSON.stringify(submitBody()),
      });
      expect(res.statusCode).toBe(401);
      expect(pluginManager.callSubmit).not.toHaveBeenCalled();
    });

    it("rejects a signature made with the wrong secret", async () => {
      const res = await submit(submitBody(), {secret: "not-the-admin-token"});
      expect(res.statusCode).toBe(401);
      expect(pluginManager.callSubmit).not.toHaveBeenCalled();
    });

    it("rejects a body that differs from the signed bytes (tamper)", async () => {
      const path = `/plugins/${PLUGIN}/${VERSION}/submit/${SUBMIT_KEY}`;
      const signed = JSON.stringify(submitBody());
      const tampered = JSON.stringify(submitBody({submission: {"pv:approved": false}}));
      const res = await app.inject({
        method: "POST",
        url: path,
        headers: {"content-type": "application/json", ...signHeaders("POST", path, signed)},
        payload: tampered,
      });
      expect(res.statusCode).toBe(401);
      expect(pluginManager.callSubmit).not.toHaveBeenCalled();
    });

    it("accepts a signature only once — a replayed submission is refused", async () => {
      const path = `/plugins/${PLUGIN}/${VERSION}/submit/${SUBMIT_KEY}`;
      const payload = JSON.stringify(submitBody());
      const headers = {
        "content-type": "application/json",
        ...signHeaders("POST", path, payload),
      };

      const first = await app.inject({method: "POST", url: path, headers, payload});
      const replay = await app.inject({method: "POST", url: path, headers, payload});

      expect(first.statusCode).toBe(200);
      expect(replay.statusCode).toBe(401);
      expect(pluginManager.callSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe("lookup chain", () => {
    it("returns 404 when the plugin version is not loaded", async () => {
      pluginManager.getManifest.mockReturnValue(null);
      const res = await submit(submitBody());
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toContain(`${PLUGIN}@${VERSION}`);
      expect(pluginManager.callSubmit).not.toHaveBeenCalled();
    });

    it("returns 400 when configurationId is missing", async () => {
      const res = await submit(submitBody({configurationId: undefined}));
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("configurationId");
      expect(pluginManager.callSubmit).not.toHaveBeenCalled();
    });

    it("returns 404 with a re-sync hint when the configuration is not in the registry", async () => {
      configRegistry.get.mockResolvedValue(undefined);
      const res = await submit(submitBody());
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toContain("re-sync");
      expect(pluginManager.callSubmit).not.toHaveBeenCalled();
    });

    it("returns 400 when the configuration targets a different plugin version", async () => {
      configRegistry.get.mockResolvedValue(storedConfig({pluginVersion: "0.2.0"}));
      const res = await submit(submitBody());
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("targets");
      expect(pluginManager.callSubmit).not.toHaveBeenCalled();
    });

    it("returns 400 when the configuration targets a different plugin", async () => {
      configRegistry.get.mockResolvedValue(storedConfig({pluginId: "other-plugin"}));
      const res = await submit(submitBody());
      expect(res.statusCode).toBe(400);
      expect(pluginManager.callSubmit).not.toHaveBeenCalled();
    });

    it.each(["serviceToken", "gzacBaseUrl"])(
      "returns 500 MISSING_CALLBACK_CONTEXT when %s was never pushed",
      async (field) => {
        configRegistry.get.mockResolvedValue(storedConfig({[field]: undefined}));
        const res = await submit(submitBody());
        expect(res.statusCode).toBe(500);
        expect(res.json()).toMatchObject({
          status: "error",
          errorCode: "MISSING_CALLBACK_CONTEXT",
        });
        expect(pluginManager.callSubmit).not.toHaveBeenCalled();
      }
    );
  });

  describe("invocation", () => {
    it("returns 200 with the hook result and threads the host-held context into the call", async () => {
      const res = await submit(submitBody());

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        status: "completed",
        variables: {approved: true},
        documentContent: {"/reviewComment": "ok"},
      });
      expect(pluginManager.callSubmit).toHaveBeenCalledWith(PLUGIN, VERSION, SUBMIT_KEY, {
        configurationId: "cfg-1",
        configuration: {setting: "x"},
        taskId: "task-1",
        processInstanceId: "pi-1",
        documentId: "doc-1",
        submission: {"pv:approved": true, "doc:/reviewComment": "looks good"},
        serviceToken: "svc-token",
        gzacBaseUrl: "http://gzac:8080",
      });
    });

    it("passes the submit key from the URL, so one plugin can host several task forms", async () => {
      await submit(submitBody(), {key: "approve"});
      expect(pluginManager.callSubmit).toHaveBeenCalledWith(
        PLUGIN,
        VERSION,
        "approve",
        expect.anything()
      );
    });

    it("defaults an absent submission to an empty object", async () => {
      await submit(submitBody({submission: undefined}));
      expect(pluginManager.callSubmit.mock.calls[0][3].submission).toEqual({});
    });

    it("forwards a submission with no document id (a process without a case)", async () => {
      await submit(submitBody({documentId: undefined}));
      expect(pluginManager.callSubmit.mock.calls[0][3]).toMatchObject({
        taskId: "task-1",
        documentId: undefined,
      });
    });

    it("maps a plugin-level rejection to 422, preserving fieldErrors for the form", async () => {
      pluginManager.callSubmit.mockResolvedValueOnce({
        status: "error",
        errorMessage: "Rejection needs a comment",
        fieldErrors: {reviewComment: "Required when rejecting"},
      });

      const res = await submit(submitBody());

      expect(res.statusCode).toBe(422);
      expect(res.json()).toEqual({
        status: "error",
        errorMessage: "Rejection needs a comment",
        fieldErrors: {reviewComment: "Required when rejecting"},
      });
    });

    it("maps a thrown host/Wasm failure to 500 HOST_ERROR", async () => {
      pluginManager.callSubmit.mockRejectedValueOnce(new Error("wasm call timed out"));
      const res = await submit(submitBody());
      expect(res.statusCode).toBe(500);
      expect(res.json()).toEqual({
        status: "error",
        errorCode: "HOST_ERROR",
        errorMessage: "wasm call timed out",
      });
    });
  });

  describe("content pin", () => {
    it("runs the hook when the stored pin matches the loaded package", async () => {
      configRegistry.get.mockResolvedValueOnce(storedConfig({expectedContentHash: "sha256:pinned"}));
      const res = await submit(submitBody());
      expect(res.statusCode).toBe(200);
      expect(pluginManager.callSubmit).toHaveBeenCalled();
    });

    it("refuses a mismatch with 409 and never runs the hook", async () => {
      configRegistry.get.mockResolvedValueOnce(
        storedConfig({expectedContentHash: "sha256:accepted"})
      );
      const res = await submit(submitBody());
      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({errorCode: "EXTERNAL_PLUGIN_CONTENT_CHANGED"});
      expect(pluginManager.callSubmit).not.toHaveBeenCalled();
    });

    it("runs the hook when no pin was pushed (older GZAC)", async () => {
      const res = await submit(submitBody());
      expect(res.statusCode).toBe(200);
      expect(pluginManager.getContentHash).not.toHaveBeenCalled();
    });
  });
});
