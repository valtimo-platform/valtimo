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

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {HostLogger} from "../models/index.js";
import type {GzacApiCallContext} from "./gzac-api";
import {createPluginContractHostFunction} from "./plugin-contract";

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

/** Drives `plugin_contract` with a fake Extism CallContext and returns the parsed reply. */
function invoke(hostCtx: GzacApiCallContext | undefined, request: unknown, timeoutMs?: number) {
  const stored: string[] = [];
  const inputJson = typeof request === "string" ? request : JSON.stringify(request);
  const callContext = {
    hostContext: () => hostCtx,
    read: (_addr: bigint) => ({ string: () => inputJson }),
    store: (s: string) => {
      stored.push(s);
      return 0n;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  const fn = createPluginContractHostFunction(noopLogger(), { timeoutMs });
  return fn(callContext, 0n).then(() => JSON.parse(stored.at(-1)!));
}

const CONTRACT = "nl.ritense.openplan@1";

const baseCtx: GzacApiCallContext = {
  configurationId: "cfg-1",
  pluginId: "pdca",
  pluginVersion: "0.2.0",
  serviceToken: "service-token-abc",
  gzacBaseUrl: "http://gzac:8080/",
  grantedCapabilities: [],
  grantedContracts: [CONTRACT],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("plugin_contract host function", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => jsonResponse({ status: "completed", result: { ok: true } }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("call", () => {
    it("posts to /call with the service token and passes GZAC's envelope through", async () => {
      const reply = await invoke(baseCtx, { kind: "call", contract: CONTRACT, operation: "list", payload: { resource: "plan" } });

      expect(reply).toEqual({ status: "completed", result: { ok: true } });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("http://gzac:8080/api/v1/plugin-contract/call");
      expect(init.method).toBe("POST");
      expect(init.headers.Authorization).toBe("Bearer service-token-abc");
      expect(init.headers["Content-Type"]).toBe("application/json");
      expect(JSON.parse(init.body)).toEqual({ contract: CONTRACT, operation: "list", payload: { resource: "plan" } });
    });

    it("needs no host capability — the contract grant is the grant", async () => {
      await invoke({ ...baseCtx, grantedCapabilities: [] }, { kind: "call", contract: CONTRACT, operation: "list" });
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("refuses a contract outside the pushed grant without any network I/O", async () => {
      const reply = await invoke(baseCtx, { kind: "call", contract: "nl.ritense.other@1", operation: "list" });

      expect(reply).toMatchObject({ status: "error", errorCode: "CONTRACT_NOT_GRANTED" });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("denies by default when no contracts were pushed", async () => {
      const reply = await invoke({ ...baseCtx, grantedContracts: undefined }, { kind: "call", contract: CONTRACT, operation: "list" });

      expect(reply).toMatchObject({ status: "error", errorCode: "CONTRACT_NOT_GRANTED" });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("sends the contract chain header only when the invocation carries a chain", async () => {
      await invoke(baseCtx, { kind: "call", contract: CONTRACT, operation: "list" });
      await invoke({ ...baseCtx, contractChain: ["cfg-0", "cfg-1"] }, { kind: "call", contract: CONTRACT, operation: "list" });

      expect(fetchMock.mock.calls[0][1].headers["X-Valtimo-Contract-Chain"]).toBeUndefined();
      expect(fetchMock.mock.calls[1][1].headers["X-Valtimo-Contract-Chain"]).toBe("cfg-0,cfg-1");
    });
  });

  describe("request", () => {
    it("posts to /jobs with replyTo and passes the accepted envelope through", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ status: "accepted", jobId: "job-1" }, 202));

      const reply = await invoke(baseCtx, {
        kind: "request",
        contract: CONTRACT,
        operation: "generate",
        payload: {},
        replyTo: { processInstanceId: "pi-1" },
      });

      expect(reply).toEqual({ status: "accepted", jobId: "job-1" });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("http://gzac:8080/api/v1/plugin-contract/jobs");
      expect(JSON.parse(init.body)).toEqual({
        contract: CONTRACT,
        operation: "generate",
        payload: {},
        replyTo: { processInstanceId: "pi-1" },
      });
    });

    it("refuses an ungranted contract and a malformed replyTo before the fetch", async () => {
      expect(await invoke(baseCtx, { kind: "request", contract: "nl.x.y@1", operation: "generate" })).toMatchObject({
        errorCode: "CONTRACT_NOT_GRANTED",
      });
      expect(
        await invoke(baseCtx, { kind: "request", contract: CONTRACT, operation: "generate", replyTo: { processInstanceId: 1 } })
      ).toMatchObject({ errorCode: "INVALID_REQUEST" });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("complete", () => {
    it("posts to /jobs/{jobId}/complete without a contract grant", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ status: "completed" }));

      const reply = await invoke(
        { ...baseCtx, grantedContracts: [] },
        { kind: "complete", jobId: "5b0c3a1e-0000-4000-8000-000000000001", status: "completed", result: { ref: "x" } }
      );

      expect(reply).toEqual({ status: "completed" });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("http://gzac:8080/api/v1/plugin-contract/jobs/5b0c3a1e-0000-4000-8000-000000000001/complete");
      expect(JSON.parse(init.body)).toEqual({ status: "completed", result: { ref: "x" } });
    });

    it.each([["../../call"], ["a/b"], [""], [42]])("refuses jobId %j without a fetch", async (jobId) => {
      const reply = await invoke(baseCtx, { kind: "complete", jobId, status: "completed" });
      expect(reply).toMatchObject({ status: "error", errorCode: "INVALID_REQUEST" });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("refuses an unknown completion status", async () => {
      const reply = await invoke(baseCtx, { kind: "complete", jobId: "job-1", status: "accepted" });
      expect(reply).toMatchObject({ status: "error", errorCode: "INVALID_REQUEST" });
    });
  });

  describe("failure mapping", () => {
    it("maps a bare HTTP error without an envelope to GZAC_ERROR", async () => {
      fetchMock.mockResolvedValueOnce(new Response("", { status: 404 }));
      const reply = await invoke(baseCtx, { kind: "complete", jobId: "job-1", status: "completed" });
      expect(reply).toEqual({ status: "error", errorCode: "GZAC_ERROR", errorMessage: "GZAC answered HTTP 404" });
    });

    it("maps a Spring error body (numeric status) to GZAC_ERROR", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ status: 403, error: "Forbidden" }, 403));
      const reply = await invoke(baseCtx, { kind: "call", contract: CONTRACT, operation: "list" });
      expect(reply).toMatchObject({ status: "error", errorCode: "GZAC_ERROR" });
    });

    it("passes an error envelope on a non-2xx status through", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ status: "error", errorCode: "PAYLOAD_TOO_LARGE", errorMessage: "big" }, 400));
      const reply = await invoke(baseCtx, { kind: "call", contract: CONTRACT, operation: "list" });
      expect(reply).toEqual({ status: "error", errorCode: "PAYLOAD_TOO_LARGE", errorMessage: "big" });
    });

    it("maps a non-JSON 200 to GZAC_ERROR", async () => {
      fetchMock.mockResolvedValueOnce(new Response("<html/>", { status: 200 }));
      const reply = await invoke(baseCtx, { kind: "call", contract: CONTRACT, operation: "list" });
      expect(reply).toMatchObject({ status: "error", errorCode: "GZAC_ERROR" });
    });

    it("maps a network failure to GZAC_UNREACHABLE", async () => {
      fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
      const reply = await invoke(baseCtx, { kind: "call", contract: CONTRACT, operation: "list" });
      expect(reply).toMatchObject({ status: "error", errorCode: "GZAC_UNREACHABLE" });
    });

    it("bounds the call with the configured timeout", async () => {
      fetchMock.mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal!.addEventListener("abort", () => reject(init.signal!.reason));
          })
      );
      const reply = await invoke(baseCtx, { kind: "call", contract: CONTRACT, operation: "list" }, 20);
      expect(reply).toMatchObject({ status: "error", errorCode: "GZAC_UNREACHABLE" });
      expect(reply.errorMessage).toContain("20ms");
    });
  });

  describe("input guard", () => {
    it("returns HOST_ERROR without an invocation context", async () => {
      expect(await invoke(undefined, { kind: "call", contract: CONTRACT, operation: "list" })).toMatchObject({
        errorCode: "HOST_ERROR",
      });
    });

    it("returns INVALID_REQUEST for malformed JSON, an unknown kind, or a missing operation", async () => {
      expect(await invoke(baseCtx, "{not json")).toMatchObject({ errorCode: "INVALID_REQUEST" });
      expect(await invoke(baseCtx, { kind: "publish" })).toMatchObject({ errorCode: "INVALID_REQUEST" });
      expect(await invoke(baseCtx, { kind: "call", contract: CONTRACT })).toMatchObject({ errorCode: "INVALID_REQUEST" });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns MISSING_CALLBACK_CONTEXT without a service token", async () => {
      const reply = await invoke({ ...baseCtx, serviceToken: "" }, { kind: "call", contract: CONTRACT, operation: "list" });
      expect(reply).toMatchObject({ status: "error", errorCode: "MISSING_CALLBACK_CONTEXT" });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
