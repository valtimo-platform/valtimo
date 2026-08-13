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

import createPlugin, {type Plugin} from "@extism/extism";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {FIXTURE_WASM} from "./fixture.js";

/**
 * L3 — the SDK runtime dispatcher (`runtime.ts`) exercised through a real Extism/QuickJS module.
 * The fixture is compiled with the actual SDK build toolchain, so these assertions reflect what a
 * shipped plugin does — including behaviours (QuickJS promise settling) that cannot be reproduced in
 * plain Node. No worker is used; a stub `gzac_api` merely satisfies the module's host import.
 */
describe("SDK runtime dispatch (compiled Wasm)", () => {
  let plugin: Plugin;

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
        },
      },
    });
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
});
