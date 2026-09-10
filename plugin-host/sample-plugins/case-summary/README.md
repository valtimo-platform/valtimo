# Case Summary Plugin

Sample external plugin demonstrating the `gzacApi` host function — a callback into GZAC from inside the Wasm plugin to fetch case data.

## What It Does

Registers a single `case-summary` action that:

- Reads `titleField` (and optionally `amountField`) from the **action's** properties, and
  `currency` from the **plugin configuration**.
- Calls back into GZAC via `gzacApi.get('/api/v1/document/{id}')` using the running case's `processBusinessKey` as the document ID.
- Looks up the configured fields in `document.content` using RFC 6901 JSON pointers.
- Returns a `caseSummary` process variable like `"Alice — EUR 12500 — (loan-application/<uuid>)"`.
- Additionally returns a `result` payload (`{ summary, title, amount, currency }`) — a second,
  independent channel from `variables` that GZAC's process-link **output mapping**
  (`actionResultMappings`) can write onto the case document or a process variable. The
  action declares these keys in `manifest.json` (`actions[].outputs`), which is what makes the
  dedicated "Output mapping" step appear in the process-link stepper at all — its source field is a
  dropdown of the declared keys (`summary`, `title`, `amount`, `currency`), not a free-text JSON
  pointer. Declaring `outputs` is a runtime contract: every declared key must be present on the
  returned `result` (the host and GZAC both reject a result with missing keys), but a key's value
  may be `null` — which the mapping writes through to the target. This demonstrates the
  action-result write-back feature end-to-end; see "Manual Test Path" below.

This is the reference sample plugin: it exercises every capability (`gzac_api`, `http_request`,
`kv`, `log`, `frontend_data`), all six frontend bundle types, all three task-form levels, declared
action outputs, i18n and a logo. A scaffolded project from `valtimo-plugin-init` is the minimal
counterpart — see [Developing an external plugin](../../docs/develop-a-plugin.md).

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
- **SDK built** — `npm install && npm run build` in `../../plugin-sdk` first

Easiest: run `npm run setup` once at the [plugin-host root](../../README.md#quick-start) — it
builds the SDK, installs this package, and packs this plugin. The Wasm toolchain (`extism-js`,
`binaryen`) is downloaded automatically on first build; no manual install needed.

## Build & Pack

```bash
npm install
npm run build       # TS → dist/plugin.wasm
npm run pack        # dist/plugin.wasm + manifest.json → dist/case-summary-0.1.0.zip
npm run build:pack  # both steps in one command
```

Upload the result to a running host with `npm run plugin:upload` from the plugin-host root.

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

Plugin configuration properties (`configurationSchema` — entered once, when an administrator
activates the plugin):

| Field | Required | Description |
|-------|----------|-------------|
| `currency` | no | Currency code prefixed in front of the amount (default `EUR`) |
| `externalApiUrl` | no | URL the `http_request` demo calls. Marked `x-egress-target`, so the value's origin joins the plugin's egress allowlist |

Action properties (`actions[].properties` — entered per process link):

| Field | Required | Description |
|-------|----------|-------------|
| `titleField` | no | JSON pointer (e.g. `/applicantName`) into `document.content`; defaults to `/applicantName` |
| `amountField` | no | JSON pointer for an optional amount field |

## Manual Test Path

1. Build & pack (`npm run build:pack`).
2. Upload `dist/case-summary-0.1.0.zip` to the Plugin Host (`POST /api/host/plugins`).
3. In GZAC admin UI: create a configuration of `case-summary`, accepting its permissions. Its
   configuration properties are `currency` and `externalApiUrl`.
4. Wire the `case-summary` action onto a BPMN service task and set the action's properties there —
   `titleField=/applicantName` (and `amountField=/loanAmount` if your case has it). Because the
   action declares `outputs` in its manifest, the stepper offers an extra "Output mapping" step
   after the action's properties — select `summary` from the source dropdown and set the target to
   `doc:/summaryText` (or `pv:summaryText` to write a process variable instead).
5. Start a case where `document.content` has those fields.
6. Verify on the running process instance: variable `caseSummary` is set; the Plugin Host log shows `gzac_api call` / `gzac_api response`; GZAC's request log shows the inbound `GET /api/v1/document/<uuid>` authenticated as `external-plugin:case-summary:<configId>`.
7. Verify the output mapping: the case document now has a `/summaryText` field (or the process variable `summaryText`, if mapped to `pv:`) equal to the plugin's `result.summary` string — confirming the action-result write-back path independently of the `variables` channel.
