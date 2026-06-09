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
 */

import { getActionHandler } from "./actions.js";
import { getEventHandlers } from "./events.js";
import { setCurrentConfig } from "./config.js";
import { log } from "./host-functions.js";
import type {
  ActionInput,
  ActionOutput,
  EventInput,
  EventOutput,
  PluginManifest,
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
      return JSON.stringify(resolved);
    }

    return JSON.stringify(result);
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
