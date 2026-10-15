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

import type { FastifyBaseLogger } from "fastify";
import { callGzac } from "./gzac.js";
import type { ConfigRecord, ConfigStore } from "./store.js";

/**
 * The app's contract provider and requester sides — natively, where a Wasm plugin would use
 * `onContractCall` / `onContractJob` / `onContractReply`. GZAC brokers every hop; the app never
 * learns who else is installed.
 */

export const ECHO_CONTRACT = "nl.ritense.demo.echo@1";
const SLOW_ECHO_DELAY_MS = 5_000;
const MAX_STORED_REPLIES = 50;

export interface ContractCallInput {
  caller: Record<string, unknown>;
  payload: unknown;
  jobId?: string;
  /** ISO-8601 instant when the answer is due: the call's budget on this app's clock, or the job's deadline. */
  deadline?: string;
  /** The case a job acts on, when known. Jobs only. */
  documentId?: string;
  /** Login of the user whose token requested the job. Jobs only. */
  requestedBy?: string;
}

export type ContractCallOutput =
  | { status: "completed"; result: unknown }
  | { status: "accepted" }
  | { status: "error"; errorCode: string; errorMessage: string };

export interface ContractReply {
  configurationId: string;
  jobId: string;
  contract: string;
  operation: string;
  status: string;
  result?: unknown;
  errorCode?: string;
  /** The provider's own error code, next to `errorCode: "PROVIDER_ERROR"`. */
  providerErrorCode?: string;
  errorMessage?: string;
  requestedAt?: string;
  completedAt?: string;
  receivedAt: string;
}

/**
 * `echo` answers synchronously. `slow-echo` is a job: it answers `accepted` and completes the job a
 * few seconds later through GZAC, as a real long-running provider would.
 */
export function runContractCall(
  record: ConfigRecord,
  store: ConfigStore,
  contract: string,
  operation: string,
  input: ContractCallInput,
  log: FastifyBaseLogger,
): ContractCallOutput {
  if (contract !== ECHO_CONTRACT) {
    return { status: "error", errorCode: "UNKNOWN_CONTRACT_OPERATION", errorMessage: `Unknown contract ${contract}` };
  }
  switch (operation) {
    case "echo":
      log.info({ caller: input.caller }, "[demo-app] contract echo");
      return { status: "completed", result: { echo: input.payload ?? null, caller: input.caller } };
    case "slow-echo": {
      if (!input.jobId) {
        return { status: "error", errorCode: "OPERATION_REQUIRES_JOB", errorMessage: "slow-echo only runs as a job" };
      }
      const jobId = input.jobId;
      log.info(
        {
          jobId,
          caller: input.caller,
          deadline: input.deadline,
          documentId: input.documentId,
          requestedBy: input.requestedBy,
        },
        "[demo-app] contract job accepted",
      );
      setTimeout(() => {
        void completeSlowEcho(store, record.configurationId, jobId, input.payload, log);
      }, SLOW_ECHO_DELAY_MS).unref();
      return { status: "accepted" };
    }
    default:
      return {
        status: "error",
        errorCode: "UNKNOWN_CONTRACT_OPERATION",
        errorMessage: `Unknown operation ${operation} of ${contract}`,
      };
  }
}

async function completeSlowEcho(
  store: ConfigStore,
  configurationId: string,
  jobId: string,
  payload: unknown,
  log: FastifyBaseLogger,
): Promise<void> {
  // Re-read at completion time: GZAC re-pushes a fresh service token on every poll.
  const record = store.get(configurationId);
  if (!record) {
    log.warn({ jobId, configurationId }, "[demo-app] configuration gone before the job completed");
    return;
  }
  try {
    const res = await callGzac(record.gzacBaseUrl, record.serviceToken, "POST", `/api/v1/plugin-contract/jobs/${jobId}/complete`, {
      status: "completed",
      result: { echo: payload ?? null, completedAt: new Date().toISOString() },
    });
    log.info({ jobId, status: res.status }, "[demo-app] contract job completed");
  } catch (err) {
    log.warn({ jobId, error: (err as Error).message }, "[demo-app] contract job completion failed");
  }
}

/** Replies to jobs this app requested, newest first. In memory, like the rest of the app. */
class ContractReplyStore {
  private readonly replies: ContractReply[] = [];

  add(reply: ContractReply): void {
    this.replies.unshift(reply);
    this.replies.length = Math.min(this.replies.length, MAX_STORED_REPLIES);
  }

  list(configurationId?: string): ContractReply[] {
    return configurationId ? this.replies.filter((r) => r.configurationId === configurationId) : [...this.replies];
  }
}

export const contractReplies = new ContractReplyStore();
