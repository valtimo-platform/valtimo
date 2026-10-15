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
import {MissingPluginExportError} from "../errors";
import {pluginContractRoutes} from "./plugin-contracts";

const PLUGIN = "openplan";
const VERSION = "0.1.0";
const CONTRACT = "nl.ritense.openplan@1";

/**
 * GZAC → provider (contract call / job delivery) and GZAC → requester (job reply). Same rails as
 * the action route; what is specific here is the `provides` gate, the chain hand-off into the host
 * context, and the 501 for a plugin built before the exports existed.
 */
describe("plugin-contracts routes", () => {
  let app: FastifyInstance;
  let pluginManager: {
    getManifest: ReturnType<typeof vi.fn>;
    getContentHash: ReturnType<typeof vi.fn>;
    callContract: ReturnType<typeof vi.fn>;
    callContractReply: ReturnType<typeof vi.fn>;
  };
  let configRegistry: {get: ReturnType<typeof vi.fn>};

  const storedConfig = (overrides: Record<string, unknown> = {}) => ({
    configurationId: "provider-cfg",
    pluginId: PLUGIN,
    pluginVersion: VERSION,
    properties: {openPlanUrl: "https://openplan.example"},
    serviceToken: "svc-token",
    gzacBaseUrl: "http://gzac:8080",
    eventSubscriptions: [],
    ...overrides,
  });

  beforeEach(async () => {
    resetReplayCacheForTests();
    pluginManager = {
      getManifest: vi.fn(() => ({
        actions: [],
        provides: [
          {
            contract: CONTRACT,
            operations: [
              {key: "list", title: "List"},
              {key: "generate", title: "Generate", mode: "job", timeout: "PT1H"},
            ],
          },
        ],
      })),
      getContentHash: vi.fn(() => "sha256:pinned"),
      callContract: vi.fn(async () => ({status: "completed", result: {status: 200, body: []}})),
      callContractReply: vi.fn(async () => ({status: "completed"})),
    };
    configRegistry = {get: vi.fn(async () => storedConfig())};
    app = await buildTestApp((a) =>
      pluginContractRoutes(a, {
        pluginManager: pluginManager as never,
        configRegistry: configRegistry as never,
        config: testConfig(),
      })
    );
  });

  afterEach(async () => {
    await app.close();
  });

  function post(path: string, body: unknown, {secret, signed = true}: {secret?: string; signed?: boolean} = {}) {
    const payload = JSON.stringify(body);
    return app.inject({
      method: "POST",
      url: path,
      headers: {
        "content-type": "application/json",
        ...(signed ? signHeaders("POST", path, payload, secret) : {}),
      },
      payload,
    });
  }

  const callPath = (operation = "list", contract = CONTRACT) =>
    `/plugins/${PLUGIN}/${VERSION}/contracts/${contract}/${operation}`;
  const replyPath = `/plugins/${PLUGIN}/${VERSION}/contract-replies`;

  const callBody = (overrides: Record<string, unknown> = {}) => ({
    configurationId: "provider-cfg",
    caller: {pluginId: "pdca", version: "0.2.0", configurationId: "requester-cfg"},
    payload: {resource: "plan"},
    chain: ["requester-cfg"],
    ...overrides,
  });

  const replyBody = (overrides: Record<string, unknown> = {}) => ({
    configurationId: "provider-cfg",
    jobId: "job-1",
    contract: CONTRACT,
    operation: "generate",
    status: "completed",
    result: {documentRef: "ref"},
    requestedAt: "2026-10-14T10:00:00Z",
    completedAt: "2026-10-14T10:05:00Z",
    ...overrides,
  });

  describe("POST /contracts/:contract/:operation", () => {
    it("runs the provider with the caller, payload and chain ending in its own configuration", async () => {
      const res = await post(callPath(), callBody());

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({status: "completed", result: {status: 200, body: []}});
      expect(pluginManager.callContract).toHaveBeenCalledWith(PLUGIN, VERSION, CONTRACT, "list", {
        configurationId: "provider-cfg",
        configuration: {openPlanUrl: "https://openplan.example"},
        caller: {pluginId: "pdca", version: "0.2.0", configurationId: "requester-cfg"},
        payload: {resource: "plan"},
        chain: ["requester-cfg", "provider-cfg"],
        serviceToken: "svc-token",
        gzacBaseUrl: "http://gzac:8080",
      });
    });

    it("forwards jobId and deadline for a job delivery and passes 'accepted' through", async () => {
      pluginManager.callContract.mockResolvedValueOnce({status: "accepted"});

      const res = await post(
        callPath("generate"),
        callBody({jobId: "job-1", deadline: "2026-10-14T12:00:00Z"})
      );

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({status: "accepted"});
      expect(pluginManager.callContract.mock.calls[0][4]).toMatchObject({
        jobId: "job-1",
        deadline: "2026-10-14T12:00:00Z",
      });
    });

    it("answers a plugin-level error with 200 so GZAC maps it", async () => {
      pluginManager.callContract.mockResolvedValueOnce({status: "error", errorCode: "NOT_FOUND"});
      const res = await post(callPath(), callBody());
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({status: "error", errorCode: "NOT_FOUND"});
    });

    it("does not duplicate its own id when GZAC already ends the chain with it, and drops junk entries", async () => {
      await post(callPath(), callBody({chain: ["requester-cfg", "bad,entry", 7, "provider-cfg"]}));
      expect(pluginManager.callContract.mock.calls[0][4].chain).toEqual(["requester-cfg", "provider-cfg"]);
    });

    it("starts a chain when GZAC sends none", async () => {
      await post(callPath(), callBody({chain: undefined}));
      expect(pluginManager.callContract.mock.calls[0][4].chain).toEqual(["provider-cfg"]);
    });

    it("rejects an unsigned request with 401", async () => {
      const res = await post(callPath(), callBody(), {signed: false});
      expect(res.statusCode).toBe(401);
      expect(pluginManager.callContract).not.toHaveBeenCalled();
    });

    it("rejects a wrong secret with 401", async () => {
      const res = await post(callPath(), callBody(), {secret: "not-the-admin-token"});
      expect(res.statusCode).toBe(401);
    });

    it("returns 404 for an unloaded plugin", async () => {
      pluginManager.getManifest.mockReturnValue(null);
      const res = await post(callPath(), callBody());
      expect(res.statusCode).toBe(404);
      expect(pluginManager.callContract).not.toHaveBeenCalled();
    });

    it("returns 400 without a configurationId and 404 for an unknown one", async () => {
      expect((await post(callPath(), callBody({configurationId: undefined}))).statusCode).toBe(400);
      configRegistry.get.mockResolvedValueOnce(undefined);
      expect((await post(callPath(), callBody({payload: {other: 1}}))).statusCode).toBe(404);
      expect(pluginManager.callContract).not.toHaveBeenCalled();
    });

    it("returns 400 when the configuration targets another plugin version", async () => {
      configRegistry.get.mockResolvedValueOnce(storedConfig({pluginVersion: "0.2.0"}));
      const res = await post(callPath(), callBody());
      expect(res.statusCode).toBe(400);
      expect(pluginManager.callContract).not.toHaveBeenCalled();
    });

    it("refuses a content-pin mismatch with 409", async () => {
      configRegistry.get.mockResolvedValueOnce(storedConfig({expectedContentHash: "sha256:accepted"}));
      const res = await post(callPath(), callBody());
      expect(res.statusCode).toBe(409);
      expect(res.json().errorCode).toBe("EXTERNAL_PLUGIN_CONTENT_CHANGED");
      expect(pluginManager.callContract).not.toHaveBeenCalled();
    });

    it.each([
      ["an undeclared operation", "delete", CONTRACT],
      ["an undeclared contract", "list", "nl.ritense.other@1"],
      ["another major version", "list", "nl.ritense.openplan@2"],
    ])("returns 404 CONTRACT_OPERATION_NOT_PROVIDED for %s", async (_label, operation, contract) => {
      const res = await post(callPath(operation, contract), callBody());
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({status: "error", errorCode: "CONTRACT_OPERATION_NOT_PROVIDED"});
      expect(pluginManager.callContract).not.toHaveBeenCalled();
    });

    it("returns 404 CONTRACT_OPERATION_NOT_PROVIDED for a manifest without provides", async () => {
      pluginManager.getManifest.mockReturnValue({actions: []});
      const res = await post(callPath(), callBody());
      expect(res.statusCode).toBe(404);
      expect(res.json().errorCode).toBe("CONTRACT_OPERATION_NOT_PROVIDED");
    });

    it.each(["serviceToken", "gzacBaseUrl"])("returns 500 MISSING_CALLBACK_CONTEXT without %s", async (field) => {
      configRegistry.get.mockResolvedValueOnce(storedConfig({[field]: undefined}));
      const res = await post(callPath(), callBody());
      expect(res.statusCode).toBe(500);
      expect(res.json().errorCode).toBe("MISSING_CALLBACK_CONTEXT");
      expect(pluginManager.callContract).not.toHaveBeenCalled();
    });

    it("returns 501 CONTRACT_NOT_IMPLEMENTED when the module lacks the export", async () => {
      pluginManager.callContract.mockRejectedValueOnce(
        new MissingPluginExportError("handle_contract_call", PLUGIN, VERSION)
      );
      const res = await post(callPath(), callBody());
      expect(res.statusCode).toBe(501);
      expect(res.json()).toMatchObject({status: "error", errorCode: "CONTRACT_NOT_IMPLEMENTED"});
    });

    it("returns 500 HOST_ERROR when execution fails", async () => {
      pluginManager.callContract.mockRejectedValueOnce(new Error("Plugin execution timed out"));
      const res = await post(callPath(), callBody());
      expect(res.statusCode).toBe(500);
      expect(res.json()).toMatchObject({status: "error", errorCode: "HOST_ERROR"});
    });
  });

  describe("POST /contract-replies", () => {
    it("delivers the reply to the requester without the host-only fields in the Wasm-bound input", async () => {
      const res = await post(replyPath, replyBody());

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({status: "completed"});
      expect(pluginManager.callContractReply).toHaveBeenCalledWith(PLUGIN, VERSION, {
        configurationId: "provider-cfg",
        configuration: {openPlanUrl: "https://openplan.example"},
        jobId: "job-1",
        contract: CONTRACT,
        operation: "generate",
        status: "completed",
        result: {documentRef: "ref"},
        errorCode: undefined,
        errorMessage: undefined,
        requestedAt: "2026-10-14T10:00:00Z",
        completedAt: "2026-10-14T10:05:00Z",
        serviceToken: "svc-token",
        gzacBaseUrl: "http://gzac:8080",
      });
    });

    it("passes 'ignored' and 'error' through with 200", async () => {
      pluginManager.callContractReply.mockResolvedValueOnce({status: "ignored"});
      expect((await post(replyPath, replyBody())).json()).toEqual({status: "ignored"});
      pluginManager.callContractReply.mockResolvedValueOnce({status: "error", errorCode: "X"});
      const res = await post(replyPath, replyBody({jobId: "job-2"}));
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({status: "error", errorCode: "X"});
    });

    it.each(["jobId", "contract", "operation", "status"])("returns 400 without %s", async (field) => {
      const res = await post(replyPath, replyBody({[field]: undefined}));
      expect(res.statusCode).toBe(400);
      expect(pluginManager.callContractReply).not.toHaveBeenCalled();
    });

    it("rejects an unsigned reply with 401", async () => {
      const res = await post(replyPath, replyBody(), {signed: false});
      expect(res.statusCode).toBe(401);
    });

    it("refuses a content-pin mismatch with 409", async () => {
      configRegistry.get.mockResolvedValueOnce(storedConfig({expectedContentHash: "sha256:accepted"}));
      const res = await post(replyPath, replyBody());
      expect(res.statusCode).toBe(409);
      expect(pluginManager.callContractReply).not.toHaveBeenCalled();
    });

    it("returns 400 for a configuration of another plugin", async () => {
      configRegistry.get.mockResolvedValueOnce(storedConfig({pluginId: "other"}));
      expect((await post(replyPath, replyBody())).statusCode).toBe(400);
    });

    it("returns 501 CONTRACT_REPLY_NOT_IMPLEMENTED when the module lacks the export", async () => {
      pluginManager.callContractReply.mockRejectedValueOnce(
        new MissingPluginExportError("handle_contract_reply", PLUGIN, VERSION)
      );
      const res = await post(replyPath, replyBody());
      expect(res.statusCode).toBe(501);
      expect(res.json()).toMatchObject({status: "error", errorCode: "CONTRACT_REPLY_NOT_IMPLEMENTED"});
    });
  });
});
