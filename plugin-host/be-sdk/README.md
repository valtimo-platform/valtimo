# External Plugin SDK (Backend)

NPM package (`@valtimo/external-plugin-sdk-be`) for building Valtimo external plugins that compile to WebAssembly.

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
- `manifest.json`
- `plugin.wasm`
- `frontend/` (if the directory exists)

## SDK API (for plugin authors)

```typescript
import { action, config, log } from "@valtimo/external-plugin-sdk-be";

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
