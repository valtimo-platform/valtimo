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

import {afterEach, describe, expect, it, vi} from "vitest";
import {action} from "./actions";
import {onContractCall, onContractJob} from "./contracts";
import {handleAction, handleContractCall, handleContractReply} from "./runtime";
import {stubWasmGlobals} from "./test-support/wasm-globals";

const actionInput = (actionKey: string) =>
  JSON.stringify({
    actionKey,
    configurationId: "cfg-1",
    configuration: {},
    processInstanceId: "pi-1",
    documentId: "doc-1",
    activityId: "act-1",
    properties: {},
  });

describe("handleAction result serialization", () => {
  it("serializes undefined result values as explicit null so declared output keys stay on the wire", () => {
    // `JSON.stringify` drops keys whose value is `undefined`; the manifest outputs contract
    // requires every declared key to be present (null allowed), so the runtime must normalise.
    action("undefined-result-values", () => ({
      status: "completed",
      result: { summary: "a summary", title: undefined, amount: null },
    }));

    const output = JSON.parse(handleAction(actionInput("undefined-result-values")));

    expect(output).toEqual({
      status: "completed",
      result: { summary: "a summary", title: null, amount: null },
    });
  });

  it("leaves variables untouched — only the result channel is normalised", () => {
    action("undefined-variable-values", () => ({
      status: "completed",
      variables: { kept: 1, dropped: undefined },
      result: { key: undefined },
    }));

    const output = JSON.parse(handleAction(actionInput("undefined-variable-values")));

    expect(output.variables).toEqual({ kept: 1 });
    expect(output.result).toEqual({ key: null });
  });

  it("passes non-object results through unchanged", () => {
    action("scalar-result", () => ({ status: "completed", result: "just a string" }));

    const output = JSON.parse(handleAction(actionInput("scalar-result")));

    expect(output).toEqual({ status: "completed", result: "just a string" });
  });
});

describe("handleContractCall result serialization", () => {
  const contractInput = (operation: string, extra: Record<string, unknown> = {}) =>
    JSON.stringify({
      contract: "nl.ritense.runtime-test@1",
      operation,
      configurationId: "cfg-1",
      configuration: {},
      caller: {pluginId: "caller", version: "1.0.0", configurationId: "cfg-0"},
      payload: {},
      ...extra,
    });

  it("serializes undefined result values as explicit null", () => {
    onContractCall("nl.ritense.runtime-test@1", "lookup", () => ({
      status: "completed",
      result: {naam: "Jan", geboortedatum: undefined},
    }));

    expect(JSON.parse(handleContractCall(contractInput("lookup")))).toEqual({
      status: "completed",
      result: {naam: "Jan", geboortedatum: null},
    });
  });

  it("reports an operation without a handler as UNKNOWN_CONTRACT_OPERATION", () => {
    expect(JSON.parse(handleContractCall(contractInput("missing")))).toMatchObject({
      status: "error",
      errorCode: "UNKNOWN_CONTRACT_OPERATION",
    });
  });

  it("refuses a job-only operation delivered without a jobId", () => {
    onContractJob("nl.ritense.runtime-test@1", "generate", () => ({status: "accepted"}));

    expect(JSON.parse(handleContractCall(contractInput("generate")))).toMatchObject({
      status: "error",
      errorCode: "OPERATION_REQUIRES_JOB",
    });
    expect(JSON.parse(handleContractCall(contractInput("generate", {jobId: "job-1"})))).toEqual({
      status: "accepted",
    });
  });

  it("hands a job handler the job's case, requester and deadline", () => {
    onContractJob("nl.ritense.runtime-test@1", "inspect", (job) => ({
      status: "completed",
      result: {documentId: job.documentId, requestedBy: job.requestedBy, deadline: job.deadline},
    }));

    const out = handleContractCall(
      contractInput("inspect", {
        jobId: "job-2",
        deadline: "2026-10-14T12:00:00Z",
        documentId: "6f1c2a3e-0000-4000-8000-000000000001",
        requestedBy: "behandelaar",
      })
    );

    expect(JSON.parse(out)).toEqual({
      status: "completed",
      result: {
        documentId: "6f1c2a3e-0000-4000-8000-000000000001",
        requestedBy: "behandelaar",
        deadline: "2026-10-14T12:00:00Z",
      },
    });
  });
});

describe("handleContractReply", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("logs a warning and reports the reply as ignored when no reply handler is registered", () => {
    const logStub = stubWasmGlobals("log");
    const reply = JSON.stringify({
      configurationId: "cfg-1",
      configuration: {},
      jobId: "job-1",
      contract: "nl.ritense.runtime-test@1",
      operation: "generate",
      status: "failed",
      errorCode: "PROVIDER_ERROR",
      providerErrorCode: "TEMPLATE_MISSING",
      requestedAt: "2026-10-14T10:00:00Z",
    });

    expect(JSON.parse(handleContractReply(reply))).toEqual({status: "ignored"});
    expect(logStub.requests).toEqual([
      {
        level: "warn",
        message: "No onContractReply handler registered; ignoring the reply for job job-1",
        data: {jobId: "job-1", contract: "nl.ritense.runtime-test@1", operation: "generate", status: "failed"},
      },
    ]);
  });
});
