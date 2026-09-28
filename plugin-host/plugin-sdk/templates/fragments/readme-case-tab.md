
## The case tab (`frontend/case-tab.tsx`)

A tab on a case, added to a case definition in the GZAC admin UI (tab type "external plugin", key
`__BUNDLE_KEY__`). It fetches its data from this plugin's own backend with
`sdk.getPluginData("/summary")`, which the Valtimo parent forwards to the host's data route and the
host answers by running the `request("/summary", …)` handler in `src/plugin.ts`.

The iframe never holds a token: the parent attaches the logged-in user's downscoped token, so the
call only succeeds for a user who may see that case. The route is gated on the `frontend_data`
capability, which `manifest.json` declares.

The tab renders three states — loading, error, ready — because a cross-process fetch can be in any
of them, and emits a `resize` message so the parent can size the iframe to the content.
