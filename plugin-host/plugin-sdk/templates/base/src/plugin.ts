__SDK_IMPORTS__

/**
 * __PLUGIN_NAME__ — a Valtimo external plugin.
 *
 * Handlers are registered at module load. `valtimo-plugin-build` bundles this file and wires the
 * Wasm exports, so this is the only backend file you need.
 */
action("__PLUGIN_ID__", (input: ActionInput) => {
  const greeting = __GREETING_SOURCE__;

  log.info("Action invoked", {actionKey: input.actionKey, documentId: input.documentId});

  return {
    status: "completed" as const,
    variables: {
      greeting: `${greeting} from __PLUGIN_ID__`,
    },
  };
});
