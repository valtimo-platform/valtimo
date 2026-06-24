# Case Summary Plugin

Sample external plugin demonstrating the `gzacApi` host function — a callback into GZAC from inside the Wasm plugin to fetch case data.

## What It Does

Registers a single `case-summary` action that:

- Reads `titleField` (and optionally `amountField`, `currency`) from the plugin configuration.
- Calls back into GZAC via `gzacApi.get('/api/v1/document/{id}')` using the running case's `processBusinessKey` as the document ID.
- Looks up the configured fields in `document.content` using RFC 6901 JSON pointers.
- Returns a `caseSummary` process variable like `"Alice — EUR 12500 — (loan-application/<uuid>)"`.

This is the second sample plugin alongside `say-hello`. Where `say-hello` only uses static configuration and BPMN action properties, `case-summary` exercises the end-to-end host-function callback path.

## Project Structure

```
manifest.json     # Plugin metadata, configuration schema, action definitions
index.d.ts        # Wasm export declarations + extism:host.user import for gzac_api
src/
  plugin.ts       # Plugin logic — registers the case-summary action handler
dist/             # Build output (gitignored)
  _plugin_bundle.js
  plugin.wasm
  case-summary-0.1.0.zip
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
npm run pack        # dist/plugin.wasm + manifest.json → dist/case-summary-0.1.0.zip
npm run build:pack  # both steps in one command
```

## How the Plugin Calls Back into GZAC

```
plugin code
   │
   │ gzacApi.get('/api/v1/document/<uuid>')
   ▼
SDK gzacApi wrapper
   │  Memory.fromString(JSON.stringify({method, path}))
   ▼
extism:host/user.gzac_api  (host function)
   │  attaches Authorization: Bearer <serviceToken>
   │  fetches `${gzacBaseUrl}${path}`
   ▼
GZAC: ExternalPluginServiceTokenAuthenticator
   │  validates the JWT → ExternalPluginServicePrincipal
   ▼
GZAC: ExternalPluginEndpointAllowlistFilter
   │  matches GET /api/v1/document/* → allow
   ▼
GZAC: JsonSchemaDocumentResource.getDocument(id)
```

Both the service token and the GZAC base URL are pushed to the Plugin Host on configuration activation — neither is visible to the Wasm plugin. The plugin only sees the response body.

## Configuration

| Field | Required | Description |
|-------|----------|-------------|
| `titleField` | yes | JSON pointer (e.g. `/applicantName`) into `document.content` |
| `amountField` | no | JSON pointer for an optional amount field |
| `currency` | no | Currency code prefixed in front of the amount (default `EUR`) |

## Manual Test Path

1. Build & pack (`npm run build:pack`).
2. Upload `dist/case-summary-0.1.0.zip` to the Plugin Host (`POST /api/host/plugins`).
3. In GZAC admin UI: create a configuration of `case-summary` with `titleField=/applicantName` (and `amountField=/loanAmount` if your case has it).
4. Wire the `case-summary` action onto a BPMN service task.
5. Start a case where `document.content` has those fields.
6. Verify on the running process instance: variable `caseSummary` is set; the Plugin Host log shows `gzac_api call` / `gzac_api response`; GZAC's request log shows the inbound `GET /api/v1/document/<uuid>` authenticated as `external-plugin:case-summary:<configId>`.
