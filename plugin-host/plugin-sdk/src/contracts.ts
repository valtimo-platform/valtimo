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

/**
 * Contracts: plugin-to-plugin calls brokered by GZAC. A plugin names a contract (`name@major`),
 * never a plugin; the admin binds a provider at activation.
 *
 * - Provider side: `onContractCall` (sync) and `onContractJob` (long-running) serve the
 *   operations declared under `provides` in the manifest. `completeJob` finishes an accepted job.
 * - Requester side: `pluginCall` (sync) and `pluginRequest` (job) call a contract declared under
 *   `permissions.contracts`; `onContractReply` receives job outcomes.
 *
 * All three host-bound calls go through the single `plugin_contract` host function. The build tool
 * only declares that import when the manifest declares contracts, so a contract-free plugin still
 * loads on a host that predates it.
 */

import type {
  ContractCallHandler,
  ContractCallResult,
  ContractCompleteResult,
  ContractJobHandler,
  ContractJobOutcome,
  ContractReplyHandler,
  ContractRequestResult,
} from "./models/index.js";

const callHandlers = new Map<string, ContractCallHandler>();
const jobHandlers = new Map<string, ContractJobHandler>();
let replyHandler: ContractReplyHandler | undefined;

function handlerKey(contract: string, operation: string): string {
  return `${contract}\u0000${operation}`;
}

/** Serve a sync operation of a provided contract. Later registrations for the same pair win. */
export function onContractCall(contract: string, operation: string, handler: ContractCallHandler): void {
  callHandlers.set(handlerKey(contract, operation), handler);
}

/**
 * Serve a `mode: "job"` operation. Return `{status: "completed", result}` to finish at once, or
 * `{status: "accepted"}` and call {@link completeJob} later with the input's `jobId`.
 */
export function onContractJob(contract: string, operation: string, handler: ContractJobHandler): void {
  jobHandlers.set(handlerKey(contract, operation), handler);
}

/** Receive the outcome of jobs this configuration requested. One handler; a later call replaces it. */
export function onContractReply(handler: ContractReplyHandler): void {
  replyHandler = handler;
}

export function getContractCallHandler(contract: string, operation: string): ContractCallHandler | undefined {
  return callHandlers.get(handlerKey(contract, operation));
}

export function getContractJobHandler(contract: string, operation: string): ContractJobHandler | undefined {
  return jobHandlers.get(handlerKey(contract, operation));
}

export function getContractReplyHandler(): ContractReplyHandler | undefined {
  return replyHandler;
}

/**
 * JSON drops `undefined` keys, which would turn a returned-but-empty output into an absent key and
 * break a declared `outputs` contract. Keeps the key as an explicit null.
 */
export function normalizeResult(result: unknown): unknown {
  if (result && typeof result === "object" && !Array.isArray(result)) {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(result as Record<string, unknown>)) {
      normalized[key] = value === undefined ? null : value;
    }
    return normalized;
  }
  return result;
}

interface PluginContractRequest {
  kind: "call" | "request" | "complete";
  contract?: string;
  operation?: string;
  payload?: unknown;
  replyTo?: { processInstanceId: string };
  jobId?: string;
  status?: "completed" | "failed";
  result?: unknown;
  errorCode?: string;
  errorMessage?: string;
}

function callPluginContract(req: PluginContractRequest): Record<string, unknown> {
  const HostGlobal = (globalThis as Record<string, unknown>).Host as
    | { getFunctions(): Record<string, unknown> }
    | undefined;
  const MemoryGlobal = (globalThis as Record<string, unknown>).Memory as
    | {
        fromString(s: string): { offset: bigint | number };
        find(offset: bigint | number): { readString(): string };
      }
    | undefined;

  if (!HostGlobal?.getFunctions || !MemoryGlobal?.fromString || !MemoryGlobal?.find) {
    throw new Error(
      "plugin_contract is only callable from inside a compiled Wasm plugin (Host/Memory globals missing)."
    );
  }

  const fn = HostGlobal.getFunctions().plugin_contract as
    | ((input: bigint | number) => bigint | number)
    | undefined;
  if (typeof fn !== "function") {
    throw new Error(
      "plugin_contract host function not found. Declare 'provides' or 'permissions.contracts' in manifest.json " +
        "(the build only imports plugin_contract then), or add it to your index.d.ts under `extism:host.user`."
    );
  }

  const inputMem = MemoryGlobal.fromString(JSON.stringify(req));
  const replyPtr = fn(inputMem.offset);
  const replyJson = MemoryGlobal.find(replyPtr).readString();
  try {
    const parsed = JSON.parse(replyJson) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  return {
    status: "error",
    errorCode: "INVALID_HOST_REPLY",
    errorMessage: "plugin_contract returned a reply that is not a JSON object",
  };
}

/**
 * Synchronous call to the provider bound to `contract`. Failures (unbound contract, provider down,
 * provider error) come back as `{status: "error", errorCode, errorMessage}`, never as a throw.
 */
export function pluginCall<T = unknown>(
  contract: string,
  operation: string,
  payload?: unknown
): ContractCallResult<T> {
  return callPluginContract({ kind: "call", contract, operation, payload: payload ?? {} }) as unknown as ContractCallResult<T>;
}

/**
 * Starts a job on the provider bound to `contract` and returns at once with its `jobId`. The outcome
 * arrives later in `onContractReply`, or — with `replyTo` — as a BPMN message
 * `contract-reply:<contract>:<operation>` correlated on the case's business key.
 */
export function pluginRequest(
  contract: string,
  operation: string,
  payload?: unknown,
  opts: { replyTo?: { processInstanceId: string } } = {}
): ContractRequestResult {
  const req: PluginContractRequest = { kind: "request", contract, operation, payload: payload ?? {} };
  if (opts.replyTo) req.replyTo = opts.replyTo;
  return callPluginContract(req) as unknown as ContractRequestResult;
}

/** Completes a job this configuration accepted as provider. GZAC only accepts it from the bound provider. */
export function completeJob(jobId: string, outcome: ContractJobOutcome): ContractCompleteResult {
  const req: PluginContractRequest = { kind: "complete", jobId, status: outcome.status };
  if (outcome.result !== undefined) req.result = normalizeResult(outcome.result);
  if (outcome.errorCode !== undefined) req.errorCode = outcome.errorCode;
  if (outcome.errorMessage !== undefined) req.errorMessage = outcome.errorMessage;
  return callPluginContract(req) as unknown as ContractCompleteResult;
}
