# Say Hello Plugin

Sample external plugin demonstrating the full plugin contract. Use this as a template for building new plugins.

## What It Does

Registers a single `say-hello` action that:
- Reads `greeting` from plugin configuration (pushed by GZAC)
- Reads `recipient` from action properties (resolved per execution)
- Returns a `greetingMessage` process variable

## Project Structure

```
manifest.json     # Plugin metadata, configuration schema, action definitions
index.d.ts        # Wasm export declarations (required by extism-js compiler)
src/
  plugin.ts       # Plugin logic — registers action handlers
dist/             # Build output (gitignored)
  _plugin_bundle.js   # Intermediate esbuild bundle
  plugin.wasm         # Compiled Wasm module
  say-hello-0.1.0.zip # Uploadable plugin package
```

## Prerequisites

- Node.js 18+
- **`extism-js` CLI** — Download from [extism/js-pdk releases](https://github.com/extism/js-pdk/releases) and place on `PATH` or in `plugin-host/.bin/`
- **`binaryen`** — `brew install binaryen` (macOS) or `apt install binaryen` (Linux)
- **SDK built** — Run `npm install && npm run build` in `../../plugin-sdk` first

## Build & Pack

```bash
npm install
npm run build       # TS → dist/plugin.wasm
npm run pack        # dist/plugin.wasm + manifest.json → dist/say-hello-0.1.0.zip
npm run build:pack  # both steps in one command
```

The output `dist/say-hello-0.1.0.zip` can be uploaded to the Plugin Host.

## How the Plugin Code Works

`src/plugin.ts` imports everything from the SDK (`@valtimo/plugin-sdk`):

1. **`action(key, handler)`** — registers a handler for an action key
2. **`config.get(key)`** — reads a value from the plugin configuration (injected per call)
3. **`log.info(msg)`** — logs to the host's logger
4. **`handle_action`** — the Wasm entrypoint, re-exported via `module.exports`

The plugin itself is just business logic — all dispatch, serialization, and Extism I/O is handled by the SDK.

## Creating a New Plugin

1. Copy this directory as a starting point
2. Update `manifest.json` — set your own `pluginId`, `version`, configuration schema, and actions
3. Update `index.d.ts` if you add more exported functions (usually `handle_action` is enough)
4. Edit `src/plugin.ts` — register your action handlers
5. Run `npm run build:pack` to produce the `.zip` in `dist/`
6. Upload to the Plugin Host via `POST /api/host/plugins`
