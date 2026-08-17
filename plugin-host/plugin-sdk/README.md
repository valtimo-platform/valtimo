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

- Node.js 18+ (Node 22+ to also run the plugin host)

That's it — the Wasm toolchain (`extism-js` and binaryen's `wasm-merge`/`wasm-opt`, which
extism-js calls) is **provisioned automatically** by `valtimo-plugin-build` on first use, on
Linux, macOS, and Windows. Copies already on your `PATH` (e.g. from `brew install binaryen`) are
used as-is; anything missing is downloaded at a pinned version (sha256-verified) into:

- `plugin-host/.bin/` (gitignored) when the SDK lives in this repository
- `~/.valtimo-plugin-sdk/toolchain/` when installed from npm

The shared logic lives in [`bin/toolchain.mjs`](./bin/toolchain.mjs) (importable as
`@valtimo/plugin-sdk/toolchain`) and honours these environment overrides:

| Variable | Effect |
|---|---|
| `VALTIMO_PLUGIN_TOOLCHAIN_DIR` | Install/download directory for the toolchain |
| `VALTIMO_EXTISM_JS` | Absolute path to an `extism-js` binary to use as-is |
| `EXTISM_JS_VERSION` | extism-js release to download (default pinned in `toolchain.mjs`) |
| `BINARYEN_VERSION` | binaryen release to download (default pinned in `toolchain.mjs`) |

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
1. Bundles the source with esbuild (CJS format, required by QuickJS) using the esbuild installed
   in the plugin project
2. Compiles the bundle to `.wasm` via the `extism-js` CLI (with binaryen on its `PATH`)
3. If `index.d.ts` exists in the plugin directory, passes it to extism-js with `-i` to declare exports

The CLI locates `extism-js` in this order (see [Prerequisites](#prerequisites)):
1. `VALTIMO_EXTISM_JS` (explicit path)
2. System `PATH`
3. A previously downloaded copy (toolchain dir, `node_modules/.bin`, `plugin-host/.bin`)
4. Automatic download of the pinned release

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

### Declaring `http_request` destinations

`http_request` is deny-by-default: the capability alone reaches nothing. Every destination has to be
declared, from one of two places depending on who knows its value.

```json
{
  "permissions": {
    "capabilities": ["http_request"],
    "egress": ["api.kvk.nl", "https://svc.vendor.com:8443"]
  },
  "configurationSchema": {
    "properties": {
      "smartDocumentsUrl": { "type": "string", "format": "uri", "x-egress-target": true }
    }
  }
}
```

- **`permissions.egress`** — origins that are the same in every environment. The admin accepts them
  on the activation screen, and they cannot change without re-accepting the plugin version.
- **`x-egress-target`** — put it on the configuration property that holds a URL which differs per
  customer or environment. The admin typing the value *is* the grant, so there is nothing extra to
  accept and the destination follows the configuration when it is edited. The property must be a
  string with `"format": "uri"`.

Entries are **origins**, matched on scheme + host + port:

- A scheme-less entry means https on 443. Write `http://…` explicitly for a plain-http target.
- A missing port means the scheme's default port, not any port — declare
  `https://svc.internal:8443` if that is the port you call.
- The path is ignored; a grant covers the whole origin. Do not include one.
- A leading `*.` wildcard is allowed with at least two labels after it (`*.vendor.com`, never
  `*.com`) and matches exactly one label — `api.vendor.com` but not `vendor.com` or
  `a.b.vendor.com`. Prefer explicit hosts: a wildcard under your own DNS is a much wider grant, and
  it is flagged as such on the admin's acceptance screen.

Declaring `egress` without `http_request` in `capabilities` fails validation, as does an unparseable
entry — the pack tool catches both before the package is built.

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
