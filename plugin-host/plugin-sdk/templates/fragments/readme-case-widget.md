
## The case widget (`frontend/case-widget.tsx`)

A widget on a case, added to a case definition's widget layout in the GZAC admin UI (key
`__BUNDLE_KEY__`). It runs on exactly the same machinery as a case tab —
`sdk.getPluginData("/summary")`, forwarded by the Valtimo parent to the host's data route, answered
by the `request("/summary", …)` handler in `src/plugin.ts`, gated on the `frontend_data` capability.

The difference is space, not plumbing: a widget shares the case page with others, so it shows one
fact rather than a full view. It renders the same loading/error/ready states, because a
cross-process fetch can be in any of them, and emits a `resize` message so the parent can size the
iframe to the content.
