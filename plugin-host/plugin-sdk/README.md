# External Plugin SDK (Backend)

NPM package (`@valtimo/plugin-sdk`) for building Valtimo external plugins that compile to WebAssembly.

## What It Provides

1. **TypeScript types** — `ActionInput`, `ActionOutput`, `PluginManifest`, etc.
2. **Runtime helpers** — `action()`, `config`, `log` for use inside plugin code
3. **`valtimo-plugin-build` CLI** — Compiles TypeScript plugin source to `.wasm` (via esbuild + extism-js)
4. **`valtimo-plugin-pack` CLI** — Assembles a `.zip` package (`manifest.json` + `plugin.wasm`) ready for upload

## Project Structure

```
src/
  models/
    types.ts        # Core type definitions
    index.ts        # Barrel export
  actions.ts        # action() handler registry
  config.ts         # config.getAll() / config.get(key) — call-scoped configuration
  host-functions.ts # log.info/warn/error — logging facade
  runtime.ts        # Wasm dispatcher: handleAction(), handleGetManifest()
  index.ts          # Public API barrel export
bin/
  valtimo-plugin-build.mjs  # TS → JS (esbuild) → .wasm (extism-js)
  valtimo-plugin-pack.mjs   # manifest.json + plugin.wasm → .zip
```

## Prerequisites

- Node.js 18+
- **`extism-js` CLI** — Download from [extism/js-pdk releases](https://github.com/extism/js-pdk/releases) and place it on your `PATH` or in `plugin-host/.bin/`
- **`binaryen`** — `brew install binaryen` (macOS) or `apt install binaryen` (Linux)

## Building the SDK

```bash
npm install
npm run build   # tsc → dist/
```

## CLI Tools

### `valtimo-plugin-build`

Compiles a plugin's TypeScript source into a `.wasm` module.

```bash
valtimo-plugin-build [--input src/plugin.ts] [--output plugin.wasm]
```

Steps performed:
1. Bundles the source with esbuild (`--format=cjs`, required by QuickJS)
2. Compiles the bundle to `.wasm` via the `extism-js` CLI
3. If `index.d.ts` exists in the plugin directory, passes it to extism-js with `-i` to declare exports

The CLI searches for the `extism-js` binary in this order:
1. System `PATH`
2. `node_modules/.bin/extism-js`
3. `plugin-host/.bin/extism-js`

### `valtimo-plugin-pack`

Assembles a plugin `.zip` ready for upload to the Plugin Host.

```bash
valtimo-plugin-pack [--wasm plugin.wasm] [--manifest manifest.json] [--output .]
```

Reads `pluginId` and `version` from `manifest.json` and produces `{pluginId}-{version}.zip` containing:
- `manifest.json` — with the packing SDK's version stamped on as `sdkVersion`, so the host can
  tell which SDK/ABI a stored plugin targets
- `plugin.wasm`
- `frontend/` (if the directory exists)

## SDK API (for plugin authors)

```typescript
import { action, config, log } from "@valtimo/plugin-sdk";

// Register an action handler
action("my-action", (input) => {
  const myConfigValue = config.get("someKey");
  log.info("Executing my-action");
  return { status: "completed", variables: { result: "done" } };
});

// config.getAll()  — returns the full configuration object
// config.get(key)  — returns a single configuration value
// log.info(msg)    — log at info level
// log.warn(msg)    — log at warn level
// log.error(msg)   — log at error level
```

### Capabilities

Host functions only work when the admin granted the matching capability at activation:
`gzac_api`, `http_request`, `kv`, `log`. A fifth capability, `frontend_data`, gates the host's
`POST /plugins/:id/:version/data` route — without it the host refuses to execute the
plugin's `handle_request` for that configuration, so declare it under
`permissions.capabilities` in `manifest.json` when the plugin serves data to its own iframes.
The `/data` route also requires a GZAC-minted downscoped user token, which the host validates
against GZAC before executing any Wasm; the Angular parent-proxy attaches it automatically, so
`sdk.getPluginData(...)` calls only succeed for authenticated users of the configuration's GZAC
instance.

## Frontend SDK (`@valtimo/plugin-sdk/frontend`)

The browser-side `ValtimoPluginSDK` runs inside the plugin's iframe and talks to the Valtimo
(Angular) parent via `postMessage`.

```typescript
import { ValtimoPluginSDK } from "@valtimo/plugin-sdk/frontend";

// Recommended for production: pin the hosting Valtimo frontend's origin. Inbound messages from
// any other origin are ignored and every outgoing message is posted to this origin only.
const sdk = new ValtimoPluginSDK({ parentOrigin: "https://valtimo.example.com" });
```

When `parentOrigin` is omitted (e.g. one bundle deployed under several Valtimo frontends), the
SDK pins the origin of the first `init` message it receives and ignores other origins from then
on. Until that pin exists, only the credential-free handshake events (`ready`, `resize`) are sent
with a `"*"` target; anything carrying data is queued and flushed to the pinned origin after
`init`. Pass `parentOrigin` whenever the hosting origin is known at build/deploy time.
