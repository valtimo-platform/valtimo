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

      expect(reply).toEqual({
        status: "error",
        errorCode: "CONTRACT_NOT_GRANTED",
        errorMessage: "Contract 'nl.ritense.other@1' is not declared and bound for this configuration",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("forwards no reply handle or idempotency key — those belong to job requests", async () => {
      await invoke(baseCtx, { kind: "call", contract: CONTRACT, operation: "list", replyTo: "h", idempotencyKey: "k" });
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ contract: CONTRACT, operation: "list", payload: {} });
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
    const HANDLE = "eyJjZmciOiJjZmctMSJ9.bWFj";

    it("posts to /jobs with the reply handle and idempotency key and passes the accepted envelope through", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ status: "accepted", jobId: "job-1" }, 202));

      const reply = await invoke(baseCtx, {
        kind: "request",
        contract: CONTRACT,
        operation: "generate",
        payload: {},
        replyTo: HANDLE,
        idempotencyKey: "report-pi-1",
      });

      expect(reply).toEqual({ status: "accepted", jobId: "job-1" });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("http://gzac:8080/api/v1/plugin-contract/jobs");
      expect(JSON.parse(init.body)).toEqual({
        contract: CONTRACT,
        operation: "generate",
        payload: {},
        replyTo: HANDLE,
        idempotencyKey: "report-pi-1",
      });
    });

    it("sends neither field when the plugin gave none (null counts as none)", async () => {
      await invoke(baseCtx, { kind: "request", contract: CONTRACT, operation: "generate" });
      await invoke(baseCtx, { kind: "request", contract: CONTRACT, operation: "generate", replyTo: null, idempotencyKey: null });

      for (const [, init] of fetchMock.mock.calls) {
        expect(JSON.parse(init.body)).toEqual({ contract: CONTRACT, operation: "generate", payload: {} });
      }
    });

    it("accepts the longest reply handle and a key of every visible ASCII character", async () => {
      const everyVisible = Array.from({ length: 0x7e - 0x21 + 1 }, (_, i) => String.fromCharCode(0x21 + i)).join("");

      await invoke(baseCtx, { kind: "request", contract: CONTRACT, operation: "generate", replyTo: "h".repeat(4096) });
      await invoke(baseCtx, { kind: "request", contract: CONTRACT, operation: "generate", idempotencyKey: everyVisible });
      await invoke(baseCtx, { kind: "request", contract: CONTRACT, operation: "generate", idempotencyKey: "k".repeat(255) });

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(JSON.parse(fetchMock.mock.calls[1][1].body).idempotencyKey).toBe(everyVisible);
    });

    it("refuses an ungranted contract before the fetch", async () => {
      expect(await invoke(baseCtx, { kind: "request", contract: "nl.x.y@1", operation: "generate" })).toMatchObject({
        errorCode: "CONTRACT_NOT_GRANTED",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
      ["an object", { processInstanceId: "pi-1" }],
      ["an empty string", ""],
      ["longer than 4096 characters", "h".repeat(4097)],
      ["a number", 42],
    ])("refuses a replyTo that is %s before the fetch", async (_label, replyTo) => {
      const reply = await invoke(baseCtx, { kind: "request", contract: CONTRACT, operation: "generate", replyTo });
      expect(reply).toEqual({
        status: "error",
        errorCode: "INVALID_REQUEST",
        errorMessage: "'replyTo' must be a reply handle: a non-empty string of at most 4096 characters",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
      ["empty", ""],
      ["longer than 255 characters", "k".repeat(256)],
      ["containing a space", "report 1"],
      ["containing a control character", "report\n1"],
      ["non-ASCII", "rapport-é"],
      ["a number", 7],
    ])("refuses an idempotencyKey that is %s before the fetch", async (_label, idempotencyKey) => {
      const reply = await invoke(baseCtx, { kind: "request", contract: CONTRACT, operation: "generate", idempotencyKey });
      expect(reply).toEqual({
        status: "error",
        errorCode: "INVALID_REQUEST",
        errorMessage: "'idempotencyKey' must be 1-255 visible ASCII characters",
      });
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

  describe("deadline", () => {
    const COMPLETE = { kind: "complete", jobId: "job-1", status: "completed" };
    const CALL = { kind: "call", contract: CONTRACT, operation: "list" };
    const REQUEST = { kind: "request", contract: CONTRACT, operation: "generate" };

    /** A GZAC that never answers; the fetch only ends when its signal aborts. */
    function hangingFetch() {
      fetchMock.mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal!.addEventListener("abort", () => reject(init.signal!.reason));
          })
      );
    }

    it.each([
      ["call", CALL],
      ["request", REQUEST],
      ["complete", COMPLETE],
    ])("refuses a %s without calling GZAC when less than 250 ms is left", async (_kind, request) => {
      const reply = await invoke({ ...baseCtx, deadlineMs: Date.now() + 100 }, request);

      expect(reply).toEqual({
        status: "error",
        errorCode: "CONTRACT_DEADLINE_EXCEEDED",
        errorMessage: "No time left for a contract call within this invocation",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("refuses once the deadline has passed", async () => {
      const reply = await invoke({ ...baseCtx, deadlineMs: Date.now() - 1_000 }, CALL);
      expect(reply).toMatchObject({ errorCode: "CONTRACT_DEADLINE_EXCEEDED" });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("hands the time left in the invocation to GZAC on a call only", async () => {
      const deadlineMs = Date.now() + 10_000;
      const ctx = { ...baseCtx, deadlineMs };

      await invoke(ctx, CALL);
      await invoke(ctx, REQUEST);
      await invoke(ctx, COMPLETE);

      const sent = Number(fetchMock.mock.calls[0][1].headers["X-Valtimo-Contract-Timeout-Ms"]);
      expect(Number.isInteger(sent)).toBe(true);
      expect(sent).toBeGreaterThan(9_000);
      expect(sent).toBeLessThanOrEqual(10_000);
      expect(fetchMock.mock.calls[1][1].headers["X-Valtimo-Contract-Timeout-Ms"]).toBeUndefined();
      expect(fetchMock.mock.calls[2][1].headers["X-Valtimo-Contract-Timeout-Ms"]).toBeUndefined();
    });

    it("sends no timeout header for an invocation without a deadline", async () => {
      await invoke(baseCtx, CALL);
      expect(fetchMock.mock.calls[0][1].headers["X-Valtimo-Contract-Timeout-Ms"]).toBeUndefined();
    });

    it("cuts the wait off at the deadline when it comes before the configured timeout", async () => {
      hangingFetch();
      const started = Date.now();

      const reply = await invoke({ ...baseCtx, deadlineMs: Date.now() + 400 }, CALL, 60_000);

      expect(reply).toMatchObject({ status: "error", errorCode: "CONTRACT_DEADLINE_EXCEEDED" });
      expect(reply.errorMessage).toMatch(/^GZAC did not answer within the \d+ms left in this invocation$/);
      expect(Date.now() - started).toBeLessThan(5_000);
    });

    it("keeps the configured timeout when it ends before the deadline", async () => {
      hangingFetch();

      const reply = await invoke({ ...baseCtx, deadlineMs: Date.now() + 60_000 }, CALL, 20);

      expect(reply).toEqual({
        status: "error",
        errorCode: "GZAC_UNREACHABLE",
        errorMessage: "GZAC did not answer within 20ms",
      });
    });
  });

  describe("correlation id", () => {
    it.each([
      ["call", { kind: "call", contract: CONTRACT, operation: "list" }],
      ["request", { kind: "request", contract: CONTRACT, operation: "generate" }],
      ["complete", { kind: "complete", jobId: "job-1", status: "completed" }],
    ])("passes the invocation's correlation id on a %s", async (_kind, request) => {
      await invoke({ ...baseCtx, correlationId: "8d3c-corr-1" }, request);
      await invoke(baseCtx, request);

      expect(fetchMock.mock.calls[0][1].headers["X-Valtimo-Correlation-Id"]).toBe("8d3c-corr-1");
      expect(fetchMock.mock.calls[1][1].headers["X-Valtimo-Correlation-Id"]).toBeUndefined();
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
