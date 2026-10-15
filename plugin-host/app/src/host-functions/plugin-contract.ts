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

import type {CallContext} from "@extism/extism";
import type {HostLogger} from "../models/index.js";
import type {GzacApiCallContext} from "./gzac-api.js";
import {readHostCall} from "./guard.js";

export const CONTRACT_CHAIN_HEADER = "X-Valtimo-Contract-Chain";
/** Milliseconds the caller still waits; relative, so clock skew between machines cannot distort it. */
export const CONTRACT_TIMEOUT_HEADER = "X-Valtimo-Contract-Timeout-Ms";
export const CORRELATION_ID_HEADER = "X-Valtimo-Correlation-Id";
export const CORRELATION_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;
const CONTRACT_API_BASE = "/api/v1/plugin-contract";
const JOB_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[\x21-\x7E]{1,255}$/;
const MAX_REPLY_TO_LENGTH = 4096;
/** Below this, a GZAC round trip cannot finish before the invocation is cancelled. */
const MIN_CONTRACT_BUDGET_MS = 250;

interface PluginContractRequest {
  kind?: unknown;
  contract?: unknown;
  operation?: unknown;
  payload?: unknown;
  replyTo?: unknown;
  idempotencyKey?: unknown;
  jobId?: unknown;
  status?: unknown;
  result?: unknown;
  errorCode?: unknown;
  errorMessage?: unknown;
}

type ContractErrorReply = {
  status: "error";
  errorCode: string;
  errorMessage: string;
};

interface OutboundCall {
  kind: "call" | "request" | "complete";
  path: string;
  body: Record<string, unknown>;
  contract?: string;
  operation?: string;
  jobId?: string;
}

/**
 * Builds the Extism host function registered as `extism:host/user::plugin_contract` — the single
 * channel for contract calls (`call`), job requests (`request`) and job completions (`complete`).
 * Every hop goes through GZAC, which resolves the binding and authorises it; the host only refuses
 * contracts outside the pushed `grantedContracts` before anything leaves, and attaches the service
 * token, the contract chain, the correlation id and — for `call` — the time left in the invocation.
 *
 * Each hop fits inside the invocation's deadline (`deadlineMs`): with less than
 * {@link MIN_CONTRACT_BUDGET_MS} left it is refused, and the fetch never outlives the deadline.
 *
 * Replies are always a JSON envelope `{status, ...}`: GZAC's answer passed through, or
 * `{status:"error", errorCode, errorMessage}` for anything the host refused or could not reach.
 */
export function createPluginContractHostFunction(
  logger: HostLogger,
  options: { timeoutMs?: number } = {}
): (callContext: CallContext, addr: bigint) => Promise<bigint> {
  const log = logger.child({ component: "plugin_contract" });
  const timeoutMs = options.timeoutMs ?? 60_000;

  return async (callContext: CallContext, addr: bigint): Promise<bigint> => {
    const reply = (body: unknown) => callContext.store(JSON.stringify(body));

    const guard = readHostCall<PluginContractRequest>(
      callContext,
      addr,
      callContext.hostContext<GzacApiCallContext | undefined>(),
      "plugin_contract"
    );
    if (!guard.ok) {
      return reply(errorReply(guard.status === 400 ? "INVALID_REQUEST" : "HOST_ERROR", guard.message));
    }
    const { ctx, req } = guard;

    const outbound = buildOutboundCall(req);
    if ("errorCode" in outbound) {
      return reply(outbound);
    }

    const logFields = {
      configurationId: ctx.configurationId,
      pluginId: ctx.pluginId,
      pluginVersion: ctx.pluginVersion,
      kind: outbound.kind,
      contract: outbound.contract,
      operation: outbound.operation,
      jobId: outbound.jobId,
      correlationId: ctx.correlationId,
    };

    if (outbound.kind !== "complete" && !(ctx.grantedContracts ?? []).includes(outbound.contract!)) {
      log.warn(logFields, "plugin_contract refused: contract not granted for this configuration");
      return reply(
        errorReply(
          "CONTRACT_NOT_GRANTED",
          `Contract '${outbound.contract}' is not declared and bound for this configuration`
        )
      );
    }

    if (!ctx.serviceToken || !ctx.gzacBaseUrl) {
      return reply(
        errorReply(
          "MISSING_CALLBACK_CONTEXT",
          "This invocation carries no service token or GZAC base URL; GZAC must re-push the configuration"
        )
      );
    }

    const deadlineMs = Number.isFinite(ctx.deadlineMs) ? (ctx.deadlineMs as number) : undefined;
    let fetchTimeoutMs = timeoutMs;
    let cutOffByDeadline = false;
    let remainingMs: number | undefined;
    if (deadlineMs !== undefined) {
      remainingMs = Math.floor(deadlineMs - Date.now());
      if (remainingMs < MIN_CONTRACT_BUDGET_MS) {
        log.warn({ ...logFields, remainingMs }, "plugin_contract refused: no time left within this invocation");
        return reply(
          errorReply("CONTRACT_DEADLINE_EXCEEDED", "No time left for a contract call within this invocation")
        );
      }
      if (remainingMs < timeoutMs) {
        fetchTimeoutMs = remainingMs;
        cutOffByDeadline = true;
      }
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${ctx.serviceToken}`,
    };
    if (ctx.contractChain && ctx.contractChain.length > 0) {
      headers[CONTRACT_CHAIN_HEADER] = ctx.contractChain.join(",");
    }
    if (outbound.kind === "call" && remainingMs !== undefined) {
      headers[CONTRACT_TIMEOUT_HEADER] = String(remainingMs);
    }
    if (ctx.correlationId) {
      headers[CORRELATION_ID_HEADER] = ctx.correlationId;
    }

    const url = `${ctx.gzacBaseUrl.replace(/\/$/, "")}${outbound.path}`;
    const start = Date.now();

    let res: Response;
    let text: string;
    try {
      res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(outbound.body),
        signal: AbortSignal.timeout(fetchTimeoutMs),
      });
      text = await res.text();
    } catch (err) {
      const out = fetchFailure(err as Error, fetchTimeoutMs, cutOffByDeadline);
      log.warn(
        { ...logFields, status: "error", errorCode: out.errorCode, durationMs: Date.now() - start, error: out.errorMessage },
        "plugin_contract call"
      );
      return reply(out);
    }

    const out = mapGzacResponse(res.status, text);
    log.info(
      {
        ...logFields,
        httpStatus: res.status,
        status: out.status,
        errorCode: (out as { errorCode?: unknown }).errorCode,
        durationMs: Date.now() - start,
      },
      "plugin_contract call"
    );
    return reply(out);
  };
}

function buildOutboundCall(req: PluginContractRequest): OutboundCall | ContractErrorReply {
  if (req === null || typeof req !== "object" || Array.isArray(req)) {
    return errorReply("INVALID_REQUEST", "plugin_contract request must be a JSON object");
  }
  if (req.kind === "call" || req.kind === "request") {
    if (typeof req.contract !== "string" || req.contract.length === 0) {
      return errorReply("INVALID_REQUEST", "Missing 'contract'");
    }
    if (typeof req.operation !== "string" || req.operation.length === 0) {
      return errorReply("INVALID_REQUEST", "Missing 'operation'");
    }
    const body: Record<string, unknown> = {
      contract: req.contract,
      operation: req.operation,
      payload: req.payload ?? {},
    };
    if (req.kind === "request") {
      if (req.replyTo !== undefined && req.replyTo !== null) {
        if (typeof req.replyTo !== "string" || req.replyTo.length === 0 || req.replyTo.length > MAX_REPLY_TO_LENGTH) {
          return errorReply(
            "INVALID_REQUEST",
            `'replyTo' must be a reply handle: a non-empty string of at most ${MAX_REPLY_TO_LENGTH} characters`
          );
        }
        body.replyTo = req.replyTo;
      }
      if (req.idempotencyKey !== undefined && req.idempotencyKey !== null) {
        if (typeof req.idempotencyKey !== "string" || !IDEMPOTENCY_KEY_PATTERN.test(req.idempotencyKey)) {
          return errorReply("INVALID_REQUEST", "'idempotencyKey' must be 1-255 visible ASCII characters");
        }
        body.idempotencyKey = req.idempotencyKey;
      }
    }
    return {
      kind: req.kind,
      path: `${CONTRACT_API_BASE}/${req.kind === "call" ? "call" : "jobs"}`,
      body,
      contract: req.contract,
      operation: req.operation,
    };
  }
  if (req.kind === "complete") {
    // Charset-checked, not just encoded: fetch resolves dot segments, so `..` would leave /jobs/.
    if (typeof req.jobId !== "string" || !JOB_ID_PATTERN.test(req.jobId)) {
      return errorReply("INVALID_REQUEST", "'jobId' must be a job id as returned by GZAC");
    }
    if (req.status !== "completed" && req.status !== "failed") {
      return errorReply("INVALID_REQUEST", "'status' must be 'completed' or 'failed'");
    }
    const body: Record<string, unknown> = { status: req.status };
    if (req.result !== undefined) body.result = req.result;
    if (typeof req.errorCode === "string") body.errorCode = req.errorCode;
    if (typeof req.errorMessage === "string") body.errorMessage = req.errorMessage;
    return { kind: "complete", path: `${CONTRACT_API_BASE}/jobs/${req.jobId}/complete`, body, jobId: req.jobId };
  }
  return errorReply("INVALID_REQUEST", "'kind' must be one of: call, request, complete");
}

function fetchFailure(err: Error, timeoutMs: number, cutOffByDeadline: boolean): ContractErrorReply {
  if (err.name !== "TimeoutError" && err.name !== "AbortError") {
    return errorReply("GZAC_UNREACHABLE", `GZAC unreachable: ${err.message}`);
  }
  return cutOffByDeadline
    ? errorReply("CONTRACT_DEADLINE_EXCEEDED", `GZAC did not answer within the ${timeoutMs}ms left in this invocation`)
    : errorReply("GZAC_UNREACHABLE", `GZAC did not answer within ${timeoutMs}ms`);
}

/**
 * GZAC's envelope (`{status: "<string>", ...}`) passes through untouched, whatever the HTTP status.
 * Anything else — a bare 404/409, a Spring error body, HTML from a proxy — becomes `GZAC_ERROR`.
 */
function mapGzacResponse(httpStatus: number, text: string): Record<string, unknown> {
  let body: unknown;
  try {
    body = text.length > 0 ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }
  if (
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    typeof (body as { status?: unknown }).status === "string" &&
    (httpStatus < 300 || (body as { status: string }).status === "error")
  ) {
    return body as Record<string, unknown>;
  }
  return errorReply(
    "GZAC_ERROR",
    httpStatus < 300 ? `GZAC answered HTTP ${httpStatus} without a contract envelope` : `GZAC answered HTTP ${httpStatus}`
  );
}

function errorReply(errorCode: string, errorMessage: string): ContractErrorReply {
  return { status: "error", errorCode, errorMessage };
}
