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
 * Runtime dispatcher for Wasm exported functions.
 *
 * The Extism JS PDK requires us to export functions from the module.
 * This file provides the handle_action and get_manifest exports that the
 * Plugin Host calls. The SDK user never imports this directly — it is
 * bundled automatically by the build tooling.
 *
 * TEST COVERAGE: this module reads low in `npm run test:cov` by design. Its dispatch paths
 * (`handle_action` / `handle_event` / `handle_request` / `handle_submit` / `handle_contract_call` /
 * `handle_contract_reply`, the config injection and
 * the QuickJS `settleSync` semantics) are covered end-to-end by the L3 suite —
 * `plugin-host/app/test/wasm/sdk-runtime.wasm.test.ts` — which runs this file *compiled to Wasm*
 * with the real extism-js toolchain. Asserting it here with mocked globals instead would test a
 * simulation of QuickJS rather than QuickJS; only the `result`-normalisation helper, whose behaviour
 * is independent of the engine, is unit-tested in `runtime.test.ts`.
 */

import {getActionHandler} from "./actions.js";
import {getEventHandlers} from "./events.js";
import {getRequestHandler} from "./requests.js";
import {getSubmitHandler} from "./submit.js";
import {setCurrentConfig} from "./config.js";
import {log} from "./host-functions.js";
import {
  getContractCallHandler,
  getContractJobHandler,
  getContractReplyHandler,
  normalizeResult,
} from "./contracts.js";
import type {
  ActionInput,
  ActionOutput,
  ContractCallInput,
  ContractCallOutput,
  ContractJobInput,
  ContractReplyInput,
  ContractReplyOutput,
  EventInput,
  EventOutput,
  PluginManifest,
  RequestInput,
  RequestOutput,
  SubmitInput,
  SubmitOutput,
} from "./models/index.js";

let pluginManifest: PluginManifest | null = null;

export function setManifest(manifest: PluginManifest): void {
  pluginManifest = manifest;
}

export function getManifest(): PluginManifest | null {
  return pluginManifest;
}

/**
 * Called by the Plugin Host for action execution.
 * Input: JSON string with ActionInput shape.
 * Output: JSON string with ActionOutput shape.
 */
export function handleAction(inputJson: string): string {
  try {
    const input: ActionInput = JSON.parse(inputJson);

    // Inject configuration into the call-scoped context
    setCurrentConfig(input.configuration || {});

    const handler = getActionHandler(input.actionKey);
    if (!handler) {
      return JSON.stringify({
        status: "error",
        errorCode: "UNKNOWN_ACTION",
        errorMessage: `No handler registered for action '${input.actionKey}'`,
      } satisfies ActionOutput);
    }

    // Execute handler (note: in QuickJS, async/await is sequential, not concurrent)
    const result = handler(input);

    // Handlers may use async/await. Under QuickJS-ng (Extism JS PDK) there is no event loop, so a
    // promise settles synchronously as the job queue drains. Capture the settled value; surface a
    // rejection as an error and never serialise a still-pending Promise object.
    if (result && typeof (result as {then?: unknown}).then === "function") {
      let settled = false;
      let rejected = false;
      let resolved: ActionOutput | undefined;
      let rejection: unknown;
      (result as Promise<ActionOutput>).then(
        (r) => {
          settled = true;
          resolved = r;
        },
        (e) => {
          settled = true;
          rejected = true;
          rejection = e;
        }
      );
      if (!settled) {
        throw new Error(
          "Async action handler did not settle synchronously; the QuickJS runtime has no event loop"
        );
      }
      if (rejected) {
        throw rejection instanceof Error ? rejection : new Error(String(rejection));
      }
      return serializeWithResult(resolved as ActionOutput);
    }

    return serializeWithResult(result as ActionOutput);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(`Action execution failed: ${message}`);
    return JSON.stringify({
      status: "error",
      errorCode: "EXECUTION_ERROR",
      errorMessage: message,
    } satisfies ActionOutput);
  }
}

/**
 * JSON has no `undefined`: `JSON.stringify` silently drops object keys whose value is `undefined`,
 * which would turn a returned-but-empty output (e.g. `result: {title}` where `title` is undefined)
 * into an absent key and violate the manifest's `outputs` contract — every declared output key must
 * be present, though null is allowed. Normalise the top-level `result` channel so a key the author
 * put on the object survives serialization as an explicit null.
 */
function serializeWithResult<T extends { result?: unknown }>(output: T): string {
  if (output && output.result !== undefined) {
    return JSON.stringify({ ...output, result: normalizeResult(output.result) });
  }
  return JSON.stringify(output);
}

/**
 * Called by the Plugin Host for event delivery.
 * Input: JSON string with EventInput shape.
 * Output: JSON string with EventOutput shape.
 *
 * Every registered event handler is invoked; the last handler that returns an EventOutput
 * determines the reported status. With no handlers registered the event is reported as ignored.
 */
export function handleEvent(inputJson: string): string {
  try {
    const event: EventInput = JSON.parse(inputJson);

    setCurrentConfig(event.configuration || {});

    const handlers = getEventHandlers();
    if (handlers.length === 0) {
      return JSON.stringify({ status: "ignored" } satisfies EventOutput);
    }

    let output: EventOutput = { status: "completed" };
    for (const handler of handlers) {
      const result = settleSync(handler(event));
      if (result && typeof result === "object" && "status" in result) {
        output = result as EventOutput;
      }
    }
    return JSON.stringify(output);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(`Event handling failed: ${message}`);
    return JSON.stringify({
      status: "error",
      errorCode: "EXECUTION_ERROR",
      errorMessage: message,
    } satisfies EventOutput);
  }
}

/**
 * Called by the Plugin Host for plugin-served data requests.
 * Input: JSON string with RequestInput shape.
 * Output: JSON string with RequestOutput shape.
 *
 * Looks up the handler by `path` (falling back to a registered catch-all). An unknown path yields a
 * 404-shaped RequestOutput rather than throwing.
 */
export function handleRequest(inputJson: string): string {
  try {
    const input: RequestInput = JSON.parse(inputJson);

    setCurrentConfig(input.configuration || {});

    const handler = getRequestHandler(input.path);
    if (!handler) {
      return JSON.stringify({
        status: 404,
        body: { error: `No request handler registered for path '${input.path}'` },
      } satisfies RequestOutput);
    }

    const result = settleSync(handler(input));
    return JSON.stringify(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(`Request handling failed: ${message}`);
    return JSON.stringify({
      status: 500,
      body: { error: message },
    } satisfies RequestOutput);
  }
}

/**
 * Called by the Plugin Host for a task-form submit hook (Level 1).
 * Input: JSON string with SubmitInput shape.
 * Output: JSON string with SubmitOutput shape.
 *
 * Looks up the handler by `submitKey` (the bundle key). An unknown key yields a `status: "error"`
 * SubmitOutput rather than throwing, so GZAC surfaces a clear message instead of a 500.
 */
export function handleSubmit(inputJson: string): string {
  try {
    const input: SubmitInput = JSON.parse(inputJson);

    setCurrentConfig(input.configuration || {});

    const handler = getSubmitHandler(input.submitKey);
    if (!handler) {
      return JSON.stringify({
        status: "error",
        errorCode: "UNKNOWN_SUBMIT_HANDLER",
        errorMessage: `No submit handler registered for key '${input.submitKey}'`,
      } satisfies SubmitOutput);
    }

    const result = settleSync(handler(input));
    return JSON.stringify(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(`Submit handling failed: ${message}`);
    return JSON.stringify({
      status: "error",
      errorCode: "EXECUTION_ERROR",
      errorMessage: message,
    } satisfies SubmitOutput);
  }
}

/**
 * Called by the Plugin Host when GZAC delivers a contract call or job to this provider.
 * Input: JSON string with ContractCallInput shape.
 * Output: JSON string with ContractCallOutput shape.
 *
 * A delivery carrying a `jobId` goes to the `onContractJob` handler, falling back to an
 * `onContractCall` handler for the same pair. Without a `jobId` only `onContractCall` applies.
 */
export function handleContractCall(inputJson: string): string {
  try {
    const input: ContractCallInput = JSON.parse(inputJson);

    setCurrentConfig(input.configuration || {});

    const isJob = typeof input.jobId === "string" && input.jobId.length > 0;
    const jobHandler = getContractJobHandler(input.contract, input.operation);
    const callHandler = getContractCallHandler(input.contract, input.operation);

    if (isJob && jobHandler) {
      return serializeWithResult(settleSync(jobHandler(input as ContractJobInput)));
    }
    if (callHandler) {
      return serializeWithResult(settleSync(callHandler(input)));
    }
    if (jobHandler) {
      return JSON.stringify({
        status: "error",
        errorCode: "OPERATION_REQUIRES_JOB",
        errorMessage: `Operation '${input.operation}' of '${input.contract}' only runs as a job`,
      } satisfies ContractCallOutput);
    }
    return JSON.stringify({
      status: "error",
      errorCode: "UNKNOWN_CONTRACT_OPERATION",
      errorMessage: `No handler registered for '${input.contract}' operation '${input.operation}'`,
    } satisfies ContractCallOutput);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(`Contract call failed: ${message}`);
    return JSON.stringify({
      status: "error",
      errorCode: "EXECUTION_ERROR",
      errorMessage: message,
    } satisfies ContractCallOutput);
  }
}

/**
 * Called by the Plugin Host when GZAC delivers the outcome of a job this configuration requested.
 * Input: JSON string with ContractReplyInput shape.
 * Output: JSON string with ContractReplyOutput shape. `ignored` when no reply handler is registered.
 */
export function handleContractReply(inputJson: string): string {
  try {
    const reply: ContractReplyInput = JSON.parse(inputJson);

    setCurrentConfig(reply.configuration || {});

    const handler = getContractReplyHandler();
    if (!handler) {
      return JSON.stringify({ status: "ignored" } satisfies ContractReplyOutput);
    }

    const result = settleSync(handler(reply));
    if (result && typeof result === "object" && "status" in result) {
      return JSON.stringify(result);
    }
    return JSON.stringify({ status: "completed" } satisfies ContractReplyOutput);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(`Contract reply handling failed: ${message}`);
    return JSON.stringify({
      status: "error",
      errorCode: "EXECUTION_ERROR",
      errorMessage: message,
    } satisfies ContractReplyOutput);
  }
}

/**
 * Settles a possibly-async handler result synchronously. Under QuickJS-ng (Extism JS PDK) there is
 * no event loop, so a promise settles as the job queue drains. Surfaces a rejection as an error and
 * never returns a still-pending Promise.
 */
function settleSync<T>(result: T | Promise<T>): T {
  if (result && typeof (result as { then?: unknown }).then === "function") {
    let settled = false;
    let rejected = false;
    let resolved: T | undefined;
    let rejection: unknown;
    (result as Promise<T>).then(
      (r) => {
        settled = true;
        resolved = r;
      },
      (e) => {
        settled = true;
        rejected = true;
        rejection = e;
      }
    );
    if (!settled) {
      throw new Error(
        "Async handler did not settle synchronously; the QuickJS runtime has no event loop"
      );
    }
    if (rejected) {
      throw rejection instanceof Error ? rejection : new Error(String(rejection));
    }
    return resolved as T;
  }
  return result as T;
}

/**
 * Called by the Plugin Host to retrieve the plugin manifest.
 */
export function handleGetManifest(): string {
  if (!pluginManifest) {
    return JSON.stringify({ error: "No manifest set" });
  }
  return JSON.stringify(pluginManifest);
}

// ---- Extism Wasm entrypoint ----
// Bridges the Extism Host I/O globals to the SDK dispatch logic.
// The build tool (valtimo-plugin-build) re-exports this from a generated entry, so authors
// never reference Host.inputString / Host.outputString or write `module.exports` themselves.

declare const Host: {
  inputString(): string;
  outputString(s: string): void;
};

/**
 * Extism-exported function that reads input from the host, dispatches
 * to the registered action handler, and writes the output back.
 *
 * Plugin usage — register handlers at module load; the build wires up the export:
 *   import { action } from "@valtimo/plugin-sdk";
 *   action("my-action", (input) => { ... });
 */
export function handle_action(): number {
  try {
    const inputJson = Host.inputString();
    const outputJson = handleAction(inputJson);
    Host.outputString(outputJson);
    return 0;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    Host.outputString(
      JSON.stringify({
        status: "error",
        errorCode: "EXECUTION_ERROR",
        errorMessage: message,
      })
    );
    return 1;
  }
}

/**
 * Extism-exported function that reads a platform event from the host, dispatches it to the
 * registered event handlers, and writes the output back.
 *
 * Plugin usage — register handlers at module load; the build wires up the export:
 *   import { onEvent } from "@valtimo/plugin-sdk";
 *   onEvent((event) => { ... });
 */
export function handle_event(): number {
  try {
    const inputJson = Host.inputString();
    const outputJson = handleEvent(inputJson);
    Host.outputString(outputJson);
    return 0;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    Host.outputString(
      JSON.stringify({
        status: "error",
        errorCode: "EXECUTION_ERROR",
        errorMessage: message,
      })
    );
    return 1;
  }
}

/**
 * Extism-exported function that reads a data request from the host, dispatches it to the registered
 * request handler, and writes the RequestOutput back.
 *
 * Plugin usage — register handlers at module load; the build wires up the export:
 *   import { request } from "@valtimo/plugin-sdk";
 *   request("/summary", (input) => ({ status: 200, body: { ... } }));
 */
export function handle_request(): number {
  try {
    const inputJson = Host.inputString();
    const outputJson = handleRequest(inputJson);
    Host.outputString(outputJson);
    return 0;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    Host.outputString(
      JSON.stringify({
        status: 500,
        body: { error: message },
      })
    );
    return 1;
  }
}

/**
 * Extism-exported function that reads a task-form submit request from the host, dispatches it to the
 * registered submit handler, and writes the SubmitOutput back.
 *
 * Plugin usage — register handlers at module load; the build wires up the export:
 *   import { submit } from "@valtimo/plugin-sdk";
 *   submit("review", (input) => ({ status: "completed", variables: { ... } }));
 */
export function handle_submit(): number {
  try {
    const inputJson = Host.inputString();
    const outputJson = handleSubmit(inputJson);
    Host.outputString(outputJson);
    return 0;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    Host.outputString(
      JSON.stringify({
        status: "error",
        errorCode: "EXECUTION_ERROR",
        errorMessage: message,
      })
    );
    return 1;
  }
}

/**
 * Extism-exported function for contract calls and job deliveries to this provider.
 *
 * Plugin usage — register handlers at module load; the build wires up the export:
 *   import { onContractCall } from "@valtimo/plugin-sdk";
 *   onContractCall("nl.example.lookup@1", "get", (input) => ({ status: "completed", result: {} }));
 */
export function handle_contract_call(): number {
  return runExport(handleContractCall);
}

/**
 * Extism-exported function for job replies to this requester.
 *
 * Plugin usage — register the handler at module load; the build wires up the export:
 *   import { onContractReply } from "@valtimo/plugin-sdk";
 *   onContractReply((reply) => ({ status: "completed" }));
 */
export function handle_contract_reply(): number {
  return runExport(handleContractReply);
}

function runExport(dispatch: (inputJson: string) => string): number {
  try {
    Host.outputString(dispatch(Host.inputString()));
    return 0;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    Host.outputString(
      JSON.stringify({
        status: "error",
        errorCode: "EXECUTION_ERROR",
        errorMessage: message,
      })
    );
    return 1;
  }
}
