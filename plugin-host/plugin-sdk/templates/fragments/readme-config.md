
## The configuration bundle (`frontend/config.tsx`)

An administrator creating a configuration of this plugin sees this React bundle in an iframe instead
of a form generated from `configurationSchema`. It collects the configuration *title* (required —
the form is invalid without it) and the `greeting` property, and reports both to the Valtimo parent
through `sdk.setConfiguration(valid, title, data)`.

Everything user-visible comes from `sdk.t(key)`, backed by the `config.*` keys in each
`translations` bucket in `manifest.json`. The bundle mounts inside `sdk.ready().then(…)` because
before that resolves `sdk.t()` returns the raw key.

`npm run pack` compiles `frontend/config.tsx` into `config.bundle.js` — the file
`frontend/config.html` loads — and includes both in the package. The compiled bundle is a build
artifact and is gitignored.
