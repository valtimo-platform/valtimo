
## The process-link action form (`frontend/action-config.tsx`)

When an administrator wires this plugin's action onto a BPMN task, the process-link stepper shows
this React bundle instead of the form it would otherwise generate from `actions[].properties`. It
configures **one use** of the action; `frontend/config.tsx` configures the plugin as a whole.

The values it reports through `sdk.setConfiguration(valid, "", data)` arrive as
`input.properties` in the `action("__PLUGIN_ID__", …)` handler in `src/plugin.ts`. The title
argument is empty on purpose — a process link has no name of its own.

GZAC matches this bundle to the action by `key`, which is why the bundle is keyed `__PLUGIN_ID__`,
exactly like `actions[0]`.

The action could also declare `outputs` in `manifest.json` to map its result onto process
variables. It doesn't here: `outputs` is a runtime contract — a completed action whose `result`
omits a declared key is rejected — and that is a sharp edge to leave behind an example.
