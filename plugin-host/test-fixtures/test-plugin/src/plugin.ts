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
 * Deterministic fixture plugin used by the Wasm/Extism (L3) tests. It is built with the real SDK
 * toolchain (`valtimo-plugin-build` → extism-js) so the tests exercise the compiled runtime, not a
 * mock. Each handler is intentionally simple and side-effect-free.
 */

import {action, config, gzacApi, onEvent, request, submit} from "@valtimo/plugin-sdk";

// Echoes the exact Wasm input the handler received. Lets a test prove that the service token and
// gzacBaseUrl are NOT serialised into the Wasm input (they ride in the host context only).
action("echo", (input) => ({
  status: "completed",
  variables: {
    inputKeys: Object.keys(input).sort(),
    input: input as unknown as Record<string, unknown>,
    configFromAccessor: config.getAll(),
  },
}));

// Awaits a resolved promise before returning. Proves the SDK runtime settles a promise
// synchronously under QuickJS (which has no event loop) — behaviour that cannot be reproduced in
// plain Node.
action("async-double", async (input) => {
  const value = Number((input.properties as { value?: number }).value ?? 0);
  const doubled = await Promise.resolve(value * 2);
  return { status: "completed", variables: { doubled } };
});

// Throws, to exercise the runtime's EXECUTION_ERROR envelope.
action("boom", () => {
  throw new Error("intentional boom");
});

// Spins forever — used by the L3 timeout test to prove the host's Wasm execution timeout
// (`wasmTimeoutMs`) really cancels a stuck call instead of hanging the host.
action("spin", () => {
  for (;;) {
    // burn CPU until the host cancels the call
  }
});

// Calls back into GZAC via the service token — exercises the gzac_api host function + host context.
action("call-gzac", () => {
  const res = gzacApi.get("/api/v1/echo");
  return { status: "completed", variables: { gzacStatus: res.status, gzacBody: res.body } };
});

onEvent((event) => {
  if (event.type === "test.event.handled") {
    return { status: "completed" };
  }
  return { status: "ignored" };
});

request("/echo", (input) => ({
  status: 200,
  body: {
    path: input.path,
    method: input.method,
    query: input.query ?? null,
    configuration: input.configuration,
  },
}));

// Task-form Level 1 hook. Rejects with per-field errors when a rejection carries no comment, and
// otherwise derives process variables plus a document field — the two branches GZAC distinguishes
// (complete the task vs. surface errors on the form).
submit("review", (input) => {
  const submission = input.submission as { approved?: boolean; comment?: string };
  if (submission.approved === false && !submission.comment) {
    return {
      status: "error",
      errorMessage: "A rejection needs a comment",
      fieldErrors: { comment: "Required when rejecting" },
    };
  }
  return {
    status: "completed",
    variables: { approved: submission.approved === true, taskId: input.taskId ?? null },
    documentContent: { "/reviewComment": submission.comment ?? "" },
  };
});

// Echoes the submit input so a test can prove no host-only secret is serialised into the Wasm input.
submit("echo-submit", (input) => ({
  status: "completed",
  variables: { inputKeys: Object.keys(input).sort() },
}));

// Throws, to exercise the runtime's EXECUTION_ERROR envelope on the submit path.
submit("boom-submit", () => {
  throw new Error("intentional submit boom");
});
