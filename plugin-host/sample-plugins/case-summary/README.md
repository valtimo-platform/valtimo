# Case Summary Plugin

Reference external plugin exercising the full SDK surface: an action with declared outputs,
`gzacApi` callbacks (service-token and as-user), request handlers backing eleven frontend bundles
of all six types, a task-form submit hook, an event handler, `kv` and `http_request` usage, and
en/nl translations.

## What It Does

The `case-summary` action:

- Reads `titleField` (and optionally `amountField`) from the action's process-link properties,
  and `currency` from the plugin configuration.
- Calls back into GZAC via `gzacApi.get('/api/v1/document/{id}')` using the running case's `processBusinessKey` as the document ID.
- Looks up the configured fields in `document.content` using RFC 6901 JSON pointers.
- Returns a `caseSummary` process variable like `"Alice — EUR 12500 — (loan-application/<uuid>)"`.
- Additionally returns a `result` payload (`{ summary, title, amount, currency }`) — a second,
  independent channel from `variables` that GZAC's process-link **output mapping**
  (`actionResultMappings`, #771) can write onto the case document or a process variable. The
  action declares these keys in `manifest.json` (`actions[].outputs`), which is what makes the
  dedicated "Output mapping" step appear in the process-link stepper at all — its source field is a
  dropdown of the declared keys (`summary`, `title`, `amount`, `currency`), not a free-text JSON
  pointer. Declaring `outputs` is a runtime contract: every declared key must be present on the
  returned `result` (the host and GZAC both reject a result with missing keys), but a key's value
  may be `null` — which the mapping writes through to the target. This demonstrates the
  action-result write-back feature end-to-end; see "Manual Test Path" below.

Beyond the action, the plugin exercises the rest of the SDK surface:

- Eight `request()` handlers serving its own screens through the host's `/data` route — including
  a service-token vs `gzacApi.asUser` comparison pair (`/case-count-as-plugin` /
  `/case-count-as-user`) and the Level-2 task-completion escape hatch (`/submit-task`).
- A `submit("review")` hook (Level-1 task form) that validates/transforms submissions and rejects
  with `fieldErrors`.
- An `onEvent` handler that reacts to the granted platform events with a `gzacApi` callback
  (posting a note on the document).
- `kv` usage (per-document view counters, aggregated by `/kv-stats`) and `http_request` egress to
  the declared `jsonplaceholder.typicode.com` plus the admin-configured `externalApiUrl`.
- Eleven frontend bundles covering all six types — config, process-link-action, two case tabs,
  two case widgets, three task forms (Levels 0/1/2), two pages — with en/nl translations and a
  logo.

## Project Structure

```
manifest.json     # Plugin metadata: config schema, action + outputs, permissions, bundles, i18n
logo.svg          # Plugin logo — packed into the zip, shown on the admin's plugin tile
src/
  plugin.ts       # All handlers: the case-summary action, request(), submit(), onEvent
frontend/         # One .html + .tsx pair per bundle (compiled by the pack tool)
dist/             # Build output (gitignored)
  _plugin_entry.mjs        # Generated Wasm entry (build intermediate)
  _plugin_interface.d.ts   # Generated export/import declarations
  case-summary-0.1.0.zip   # The uploadable package (wasm + manifest + logo + frontend)
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
npm run pack        # manifest + wasm + logo + frontend bundles → dist/case-summary-0.1.0.zip
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

## Configuration and Action Properties

The plugin configuration (filled in and accepted by the admin at activation):

| Field | Required | Description |
|-------|----------|-------------|
| `currency` | no | Currency code prefixed in front of the amount (default `EUR`) |
| `externalApiUrl` | no | URL for the `/external-data` demo call. Marked `x-egress-target`, so the admin typing the value *is* the egress grant |

The `case-summary` action's properties (entered on the process link in the modeler):

| Property | Required | Description |
|----------|----------|-------------|
| `titleField` | yes | JSON pointer (e.g. `/applicantName`) into `document.content` |
| `amountField` | no | JSON pointer for an optional amount field |
| `summaryVariable` | no | Process variable receiving the summary (default `caseSummary`) |
| `definitionKeyVariable` | no | Process variable receiving the case definition key (default `caseDefinitionKey`) |

## Manual Test Path

1. Build & pack (`npm run build:pack`).
2. Upload `dist/case-summary-0.1.0.zip` to the Plugin Host (`POST /api/host/plugins`).
3. In GZAC admin UI: create a configuration of `case-summary` (the defaults are fine; adjust `currency` if wanted).
4. Wire the `case-summary` action onto a BPMN service task with `titleField=/applicantName` (and
   `amountField=/loanAmount` if your case has it) in the action's properties. Because the action
   declares `outputs` in its manifest, the stepper offers an extra "Output mapping" step after the
   action's properties — select `summary` from the source dropdown and set the target to
   `doc:/summaryText` (or `pv:summaryText` to write a process variable instead).
5. Start a case where `document.content` has those fields.
6. Verify on the running process instance: variable `caseSummary` is set; the Plugin Host log shows `gzac_api call` / `gzac_api response`; GZAC's request log shows the inbound `GET /api/v1/document/<uuid>` authenticated as `external-plugin:case-summary:<configId>`.
7. Verify the output mapping: the case document now has a `/summaryText` field (or the process variable `summaryText`, if mapped to `pv:`) equal to the plugin's `result.summary` string — confirming the action-result write-back path independently of the `variables` channel.
