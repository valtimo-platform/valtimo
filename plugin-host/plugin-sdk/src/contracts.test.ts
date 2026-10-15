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
import {
  completeJob,
  getContractCallHandler,
  getContractJobHandler,
  getContractReplyHandler,
  normalizeResult,
  onContractCall,
  onContractJob,
  onContractReply,
  pluginCall,
  pluginRequest,
} from "./contracts";
import {stubWasmGlobals} from "./test-support/wasm-globals";

/**
 * The contract wrappers around the single `plugin_contract` host function. The host decides what to
 * do from the request envelope's `kind`, so the envelope is what these pin; remote failures must
 * come back as an envelope, never as a throw into plugin code.
 */
describe("contract host-function wrappers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pluginCall sends a call envelope and returns the host's reply", () => {
    const stub = stubWasmGlobals("plugin_contract");
    stub.replyWith({status: "completed", result: {naam: "Jan"}});

    const out = pluginCall("nl.ritense.bsn-lookup@1", "lookup", {bsn: "123"});

    expect(stub.requests[0]).toEqual({
      kind: "call",
      contract: "nl.ritense.bsn-lookup@1",
      operation: "lookup",
      payload: {bsn: "123"},
    });
    expect(out).toEqual({status: "completed", result: {naam: "Jan"}});
  });

  it("pluginCall defaults a missing payload to an empty object", () => {
    const stub = stubWasmGlobals("plugin_contract");
    stub.replyWith({status: "completed"});

    pluginCall("nl.ritense.bsn-lookup@1", "lookup");

    expect(stub.requests[0]).toMatchObject({payload: {}});
  });

  it("returns a remote error as an envelope instead of throwing", () => {
    const stub = stubWasmGlobals("plugin_contract");
    stub.replyWith({status: "error", errorCode: "CONTRACT_NOT_GRANTED", errorMessage: "nope"});

    expect(pluginCall("nl.ritense.bsn-lookup@1", "lookup", {})).toEqual({
      status: "error",
      errorCode: "CONTRACT_NOT_GRANTED",
      errorMessage: "nope",
    });
  });

  it("maps a non-object host reply onto an INVALID_HOST_REPLY envelope", () => {
    const stub = stubWasmGlobals("plugin_contract");
    stub.replyWith("just a string");

    expect(pluginCall("nl.ritense.bsn-lookup@1", "lookup", {})).toMatchObject({
      status: "error",
      errorCode: "INVALID_HOST_REPLY",
    });
  });

  it("pluginRequest sends a request envelope, with replyTo and idempotencyKey only when given", () => {
    const stub = stubWasmGlobals("plugin_contract");
    stub.replyWith({status: "accepted", jobId: "job-1"});
    stub.replyWith({status: "accepted", jobId: "job-2"});
    stub.replyWith({status: "accepted", jobId: "job-3"});

    const first = pluginRequest("nl.ritense.document.generate@1", "generate", {templateKey: "t"});
    pluginRequest("nl.ritense.document.generate@1", "generate", {}, {replyTo: "eyJjZmciOiJjIn0.mac"});
    pluginRequest("nl.ritense.document.generate@1", "generate", undefined, {
      replyTo: "eyJjZmciOiJjIn0.mac",
      idempotencyKey: "report-pi-1",
    });

    expect(first).toEqual({status: "accepted", jobId: "job-1"});
    expect(stub.requests[0]).toEqual({
      kind: "request",
      contract: "nl.ritense.document.generate@1",
      operation: "generate",
      payload: {templateKey: "t"},
    });
    expect(stub.requests[1]).toEqual({
      kind: "request",
      contract: "nl.ritense.document.generate@1",
      operation: "generate",
      payload: {},
      replyTo: "eyJjZmciOiJjIn0.mac",
    });
    expect(stub.requests[2]).toEqual({
      kind: "request",
      contract: "nl.ritense.document.generate@1",
      operation: "generate",
      payload: {},
      replyTo: "eyJjZmciOiJjIn0.mac",
      idempotencyKey: "report-pi-1",
    });
  });

  it("passes options through unvalidated — the host function judges them", () => {
    const stub = stubWasmGlobals("plugin_contract");
    stub.replyWith({status: "error", errorCode: "INVALID_REQUEST", errorMessage: "bad key"});

    const out = pluginRequest("nl.ritense.document.generate@1", "generate", {}, {idempotencyKey: "has space"});

    expect(stub.requests[0]).toMatchObject({idempotencyKey: "has space"});
    expect(out).toEqual({status: "error", errorCode: "INVALID_REQUEST", errorMessage: "bad key"});
  });

  it("returns a provider's own error code next to PROVIDER_ERROR", () => {
    const stub = stubWasmGlobals("plugin_contract");
    stub.replyWith({
      status: "error",
      errorCode: "PROVIDER_ERROR",
      providerErrorCode: "BSN_UNKNOWN",
      errorMessage: "No person with that BSN",
    });

    expect(pluginCall("nl.ritense.bsn-lookup@1", "lookup", {bsn: "1"})).toEqual({
      status: "error",
      errorCode: "PROVIDER_ERROR",
      providerErrorCode: "BSN_UNKNOWN",
      errorMessage: "No person with that BSN",
    });
  });

  it("completeJob sends a complete envelope and keeps undefined result keys as null", () => {
    const stub = stubWasmGlobals("plugin_contract");
    stub.replyWith({status: "completed"});

    const out = completeJob("job-1", {status: "completed", result: {documentRef: "ref", contentHash: undefined}});

    expect(out).toEqual({status: "completed"});
    expect(stub.requests[0]).toEqual({
      kind: "complete",
      jobId: "job-1",
      status: "completed",
      result: {documentRef: "ref", contentHash: null},
    });
  });

  it("completeJob forwards a failure's error fields", () => {
    const stub = stubWasmGlobals("plugin_contract");
    stub.replyWith({status: "completed"});

    completeJob("job-1", {status: "failed", errorCode: "TEMPLATE_MISSING", errorMessage: "no template"});

    expect(stub.requests[0]).toEqual({
      kind: "complete",
      jobId: "job-1",
      status: "failed",
      errorCode: "TEMPLATE_MISSING",
      errorMessage: "no template",
    });
  });

  it("throws a clear error outside Wasm", () => {
    stubWasmGlobals("plugin_contract", {hostMissing: true});
    expect(() => pluginCall("nl.ritense.bsn-lookup@1", "lookup", {})).toThrow(/only callable from inside a compiled Wasm plugin/);
  });

  it("throws a clear error when the build did not import plugin_contract", () => {
    stubWasmGlobals("plugin_contract", {fnMissing: true});
    expect(() => pluginCall("nl.ritense.bsn-lookup@1", "lookup", {})).toThrow(/permissions\.contracts/);
  });
});

describe("contract handler registries", () => {
  it("keeps call and job handlers apart per contract and operation", () => {
    const call = vi.fn(() => ({status: "completed" as const}));
    const job = vi.fn(() => ({status: "accepted" as const}));
    onContractCall("nl.ritense.registry-test@1", "get", call);
    onContractJob("nl.ritense.registry-test@1", "generate", job);

    expect(getContractCallHandler("nl.ritense.registry-test@1", "get")).toBe(call);
    expect(getContractJobHandler("nl.ritense.registry-test@1", "generate")).toBe(job);
    expect(getContractCallHandler("nl.ritense.registry-test@1", "generate")).toBeUndefined();
    expect(getContractCallHandler("nl.ritense.registry-test@2", "get")).toBeUndefined();
  });

  it("lets a later reply handler replace an earlier one", () => {
    const first = vi.fn();
    const second = vi.fn();
    onContractReply(first);
    onContractReply(second);

    expect(getContractReplyHandler()).toBe(second);
  });
});

describe("normalizeResult", () => {
  it("turns undefined object values into null and leaves other shapes alone", () => {
    expect(normalizeResult({a: undefined, b: 1})).toEqual({a: null, b: 1});
    expect(normalizeResult([undefined])).toEqual([undefined]);
    expect(normalizeResult("x")).toBe("x");
    expect(normalizeResult(null)).toBeNull();
  });
});
