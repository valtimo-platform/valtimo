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

import createPlugin, {type CallContext, type Plugin} from "@extism/extism";
import {afterAll, beforeAll, beforeEach, describe, expect, it} from "vitest";
import {readFileSync} from "node:fs";
import {CONTRACT_FREE_FIXTURE_WASM, FIXTURE_WASM} from "./fixture.js";

/**
 * L3 — the SDK runtime dispatcher (`runtime.ts`) exercised through a real Extism/QuickJS module.
 * The fixture is compiled with the actual SDK build toolchain, so these assertions reflect what a
 * shipped plugin does — including behaviours (QuickJS promise settling) that cannot be reproduced in
 * plain Node. No worker is used; a stub `gzac_api` merely satisfies the module's host import.
 */
describe("SDK runtime dispatch (compiled Wasm)", () => {
  let plugin: Plugin;
  /** Every `plugin_contract` envelope the module sent, parsed. */
  const contractRequests: unknown[] = [];

  beforeAll(async () => {
    // Stub every host import the SDK bundle declares (the module fails to instantiate if one is
    // missing); only gzac_api returns a meaningful reply, the rest just satisfy the import.
    const okReply = (body: unknown) => (cc: { store: (s: string) => bigint }) =>
      cc.store(JSON.stringify(body));
    plugin = await createPlugin(FIXTURE_WASM, {
      useWasi: true,
      functions: {
        "extism:host/user": {
          gzac_api: okReply({ status: 200, headers: {}, body: {} }),
          http_request: okReply({ status: 200, headers: {}, body: {} }),
          kv: okReply({ status: 200 }),
          log: okReply({ status: 200 }),
          plugin_contract: (cc: CallContext, addr: bigint) => {
            contractRequests.push(JSON.parse(cc.read(addr)!.string()));
            return cc.store(JSON.stringify({ status: "completed", result: { stubbed: true } }));
          },
        },
      },
    });
  });

  beforeEach(() => {
    contractRequests.length = 0;
  });

  afterAll(async () => {
    await plugin?.close();
  });

  async function call(fn: string, input: unknown): Promise<Record<string, unknown>> {
    const out = await plugin.call(fn, JSON.stringify(input));
    return JSON.parse(out!.text());
  }

  const actionInput = (actionKey: string, extra: Record<string, unknown> = {}) => ({
    actionKey,
    configurationId: "cfg-1",
    configuration: { greeting: "hi" },
    processInstanceId: "pi",
    documentId: "doc",
    activityId: "act",
    properties: {},
    ...extra,
  });

  describe("handle_action", () => {
    it("dispatches to the registered handler and exposes the config accessor", async () => {
      const out = await call("handle_action", actionInput("echo"));
      expect(out.status).toBe("completed");
      const variables = out.variables as Record<string, unknown>;
      expect(variables.configFromAccessor).toEqual({ greeting: "hi" });
    });

    it("only sees the ActionInput fields — no host-only secrets leak into the Wasm input", async () => {
      // The Wasm input is exactly what the SDK dispatched to the handler. Even if a caller added
      // extra keys, the shape a plugin receives must be the declared ActionInput and nothing more.
      const out = await call("handle_action", actionInput("echo"));
      const variables = out.variables as { inputKeys: string[] };
      expect(variables.inputKeys).toEqual([
        "actionKey",
        "activityId",
        "configuration",
        "configurationId",
        "documentId",
        "processInstanceId",
        "properties",
      ]);
      expect(variables.inputKeys).not.toContain("serviceToken");
      expect(variables.inputKeys).not.toContain("gzacBaseUrl");
    });

    it("returns UNKNOWN_ACTION for an unregistered key", async () => {
      const out = await call("handle_action", actionInput("does-not-exist"));
      expect(out).toMatchObject({ status: "error", errorCode: "UNKNOWN_ACTION" });
    });

    it("sends a job request carrying the action's reply handle and the idempotency key", async () => {
      const out = await call(
        "handle_action",
        actionInput("request-job", { replyHandle: "eyJwaSI6InBpIn0.bWFj", properties: { idempotencyKey: "report-pi" } })
      );

      expect(out.status).toBe("completed");
      expect(contractRequests).toEqual([
        {
          kind: "request",
          contract: "nl.ritense.test.upstream@1",
          operation: "generate",
          payload: { q: 1 },
          replyTo: "eyJwaSI6InBpIn0.bWFj",
          idempotencyKey: "report-pi",
        },
      ]);
    });

    it("sends neither option when the action has no reply handle and no key", async () => {
      await call("handle_action", actionInput("request-job"));
      expect(contractRequests).toEqual([
        { kind: "request", contract: "nl.ritense.test.upstream@1", operation: "generate", payload: { q: 1 } },
      ]);
    });

    it("wraps a thrown error in an EXECUTION_ERROR envelope with the message", async () => {
      const out = await call("handle_action", actionInput("boom"));
      expect(out).toMatchObject({ status: "error", errorCode: "EXECUTION_ERROR", errorMessage: "intentional boom" });
    });

    // KNOWN LIMITATION (verified here, not assumed): under the Extism JS PDK (QuickJS-ng) an awaited
    // promise does NOT settle synchronously, so a handler that performs a real `await` cannot be
    // supported by the current `settleSync` and fails. Plugins must use the synchronous `gzacApi.*`
    // (the host suspends the call) rather than `async`/`await` on JS promises. This assertion pins
    // that behaviour; if the runtime gains real async support it should flip to a success.
    it("does NOT settle a genuinely-async handler (QuickJS has no event loop)", async () => {
      const out = await call("handle_action", actionInput("async-double", { properties: { value: 21 } }));
      expect(out).toMatchObject({ status: "error", errorCode: "EXECUTION_ERROR" });
      expect(out.errorMessage).toMatch(/did not settle synchronously/);
    });
  });

  describe("handle_event", () => {
    it("reports completed for a handled event type", async () => {
      const out = await call("handle_event", { type: "test.event.handled", id: "e", source: "s", configuration: {} });
      expect(out).toEqual({ status: "completed" });
    });

    it("reports ignored for an unhandled event type", async () => {
      const out = await call("handle_event", { type: "other.type", id: "e", source: "s", configuration: {} });
      expect(out).toEqual({ status: "ignored" });
    });
  });

  describe("handle_request", () => {
    it("routes to the registered path handler and echoes the request", async () => {
      const out = await call("handle_request", {
        method: "GET",
        path: "/echo",
        query: { a: "b" },
        configuration: { c: 1 },
      });
      expect(out.status).toBe(200);
      expect(out.body).toEqual({ path: "/echo", method: "GET", query: { a: "b" }, configuration: { c: 1 } });
    });

    it("returns a 404-shaped output for an unregistered path", async () => {
      const out = await call("handle_request", { method: "GET", path: "/nope", configuration: {} });
      expect(out.status).toBe(404);
    });
  });

  describe("handle_submit (task-form Level 1 hook)", () => {
    const submitInput = (submitKey: string, submission: Record<string, unknown> = {}) => ({
      submitKey,
      configurationId: "cfg-1",
      configuration: { greeting: "hi" },
      taskId: "task-1",
      processInstanceId: "pi-1",
      documentId: "doc-1",
      submission,
    });

    it("completes with derived variables and document content", async () => {
      const out = await call(
        "handle_submit",
        submitInput("review", { approved: true, comment: "looks good" })
      );
      expect(out).toEqual({
        status: "completed",
        variables: { approved: true, taskId: "task-1" },
        documentContent: { "/reviewComment": "looks good" },
      });
    });

    it("rejects with fieldErrors so GZAC does not complete the task", async () => {
      const out = await call("handle_submit", submitInput("review", { approved: false }));
      expect(out).toEqual({
        status: "error",
        errorMessage: "A rejection needs a comment",
        fieldErrors: { comment: "Required when rejecting" },
      });
    });

    it("only sees the SubmitInput fields — no host-only secrets leak into the Wasm input", async () => {
      const out = await call("handle_submit", submitInput("echo-submit", { a: 1 }));
      expect(out.variables).toEqual({
        inputKeys: [
          "configuration",
          "configurationId",
          "documentId",
          "processInstanceId",
          "submission",
          "submitKey",
          "taskId",
        ],
      });
    });

    it("returns UNKNOWN_SUBMIT_HANDLER for an unregistered key", async () => {
      const out = await call("handle_submit", submitInput("not-registered"));
      expect(out).toMatchObject({ status: "error", errorCode: "UNKNOWN_SUBMIT_HANDLER" });
      expect(out.errorMessage).toContain("not-registered");
    });

    it("wraps a thrown hook error in an EXECUTION_ERROR envelope", async () => {
      const out = await call("handle_submit", submitInput("boom-submit"));
      expect(out).toMatchObject({
        status: "error",
        errorCode: "EXECUTION_ERROR",
        errorMessage: "intentional submit boom",
      });
    });
  });

  describe("handle_contract_call (provider)", () => {
    const contractInput = (operation: string, extra: Record<string, unknown> = {}) => ({
      contract: "nl.ritense.test.echo@1",
      operation,
      configurationId: "provider-cfg",
      configuration: { greeting: "hi" },
      caller: { pluginId: "pdca", version: "0.2.0", configurationId: "requester-cfg" },
      payload: { q: 1 },
      ...extra,
    });

    it("dispatches a sync call with the config accessor and keeps undefined result keys as null", async () => {
      const out = await call("handle_contract_call", contractInput("echo"));
      expect(out).toEqual({
        status: "completed",
        result: {
          inputKeys: ["caller", "configuration", "configurationId", "contract", "operation", "payload"],
          payload: { q: 1 },
          caller: { pluginId: "pdca", version: "0.2.0", configurationId: "requester-cfg" },
          configFromAccessor: { greeting: "hi" },
          absent: null,
        },
      });
    });

    it("lets a job handler accept a job for later completion", async () => {
      const out = await call("handle_contract_call", contractInput("slow-echo", { jobId: "job-1", deadline: "2026-10-14T12:00:00Z" }));
      expect(out).toEqual({ status: "accepted" });
    });

    it("lets a job handler complete a job at once with the jobId and deadline it was given", async () => {
      const out = await call("handle_contract_call", contractInput("instant-job", { jobId: "job-2", deadline: "2026-10-14T12:00:00Z" }));
      expect(out).toEqual({ status: "completed", result: { jobId: "job-2", deadline: "2026-10-14T12:00:00Z" } });
    });

    it("refuses a job-only operation delivered without a jobId", async () => {
      const out = await call("handle_contract_call", contractInput("slow-echo"));
      expect(out).toMatchObject({ status: "error", errorCode: "OPERATION_REQUIRES_JOB" });
    });

    it("returns UNKNOWN_CONTRACT_OPERATION for an operation or contract without a handler", async () => {
      expect(await call("handle_contract_call", contractInput("does-not-exist"))).toMatchObject({
        status: "error",
        errorCode: "UNKNOWN_CONTRACT_OPERATION",
      });
      expect(
        await call("handle_contract_call", contractInput("echo", { contract: "nl.ritense.test.echo@2" }))
      ).toMatchObject({ status: "error", errorCode: "UNKNOWN_CONTRACT_OPERATION" });
    });

    it("wraps a thrown handler error in an EXECUTION_ERROR envelope", async () => {
      expect(await call("handle_contract_call", contractInput("boom"))).toMatchObject({
        status: "error",
        errorCode: "EXECUTION_ERROR",
        errorMessage: "intentional contract boom",
      });
    });

    it("hands a nested pluginCall the plugin_contract reply as a value, not a throw", async () => {
      const out = await call("handle_contract_call", contractInput("nested"));
      expect(out).toEqual({ status: "completed", result: { upstream: { status: "completed", result: { stubbed: true } } } });
    });
  });

  describe("handle_contract_reply (requester)", () => {
    const replyInput = (jobId: string) => ({
      configurationId: "requester-cfg",
      configuration: {},
      jobId,
      contract: "nl.ritense.test.echo@1",
      operation: "slow-echo",
      status: "completed",
      result: { echoed: true },
      requestedAt: "2026-10-14T10:00:00Z",
      completedAt: "2026-10-14T10:05:00Z",
    });

    it("acknowledges a reply through the registered handler", async () => {
      expect(await call("handle_contract_reply", replyInput("job-1"))).toEqual({ status: "completed" });
    });

    it("passes a handler's error through so GZAC retries the delivery", async () => {
      expect(await call("handle_contract_reply", replyInput("unknown-job"))).toMatchObject({
        status: "error",
        errorCode: "UNKNOWN_JOB",
      });
    });
  });
});

/**
 * The build tool imports `plugin_contract` only for a manifest that declares contracts, so a
 * contract-free module instantiates on a host that offers no such host function.
 */
describe("plugin_contract import is conditional on the manifest", () => {
  const userImports = (wasmPath: string) =>
    WebAssembly.Module.imports(new WebAssembly.Module(readFileSync(wasmPath)))
      .filter((i) => i.module === "extism:host/user")
      .map((i) => i.name)
      .sort();

  it("imports plugin_contract when the manifest declares contracts", () => {
    expect(userImports(FIXTURE_WASM)).toContain("plugin_contract");
  });

  it("does not import plugin_contract for a contract-free manifest", () => {
    expect(userImports(CONTRACT_FREE_FIXTURE_WASM)).toEqual(["gzac_api", "http_request", "kv", "log"]);
  });

  it("loads with only the gzac_api, http_request, kv and log host functions and still exports the contract entrypoints", async () => {
    const okReply = (body: unknown) => (cc: { store: (s: string) => bigint }) => cc.store(JSON.stringify(body));
    const contractFree = await createPlugin(CONTRACT_FREE_FIXTURE_WASM, {
      useWasi: true,
      functions: {
        "extism:host/user": {
          gzac_api: okReply({ status: 200, headers: {}, body: {} }),
          http_request: okReply({ status: 200, headers: {}, body: {} }),
          kv: okReply({ status: 200 }),
          log: okReply({ status: 200 }),
        },
      },
    });
    try {
      const action = JSON.parse(
        (await contractFree.call(
          "handle_action",
          JSON.stringify({ actionKey: "echo", configurationId: "c", configuration: {}, processInstanceId: "p", documentId: "d", activityId: "a", properties: {} })
        ))!.text()
      );
      expect(action.status).toBe("completed");

      // Calling a contract without the import is a clear in-plugin error, not a host crash.
      const nested = JSON.parse(
        (await contractFree.call(
          "handle_contract_call",
          JSON.stringify({ contract: "nl.ritense.test.echo@1", operation: "nested", configurationId: "c", configuration: {}, caller: {}, payload: {} })
        ))!.text()
      );
      expect(nested).toMatchObject({ status: "error", errorCode: "EXECUTION_ERROR" });
      expect(nested.errorMessage).toMatch(/plugin_contract host function not found/);
    } finally {
      await contractFree.close();
    }
  });
});
