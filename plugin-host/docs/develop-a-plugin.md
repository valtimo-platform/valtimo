<!--
  Copyright 2015-2026 Ritense BV, the Netherlands.
  Licensed under EUPL, Version 1.2 (the "License");
  https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
-->

# Developing an external plugin

> **Audience:** plugin developers. For the administrator side (connecting hosts, uploading,
> activating) see the [admin documentation](../../documentation/configuration-guides/plugins/external-plugins/README.md).

An external plugin is a TypeScript project compiled to WebAssembly and packed into a `.zip`. The
plugin host runs the Wasm in a sandbox; the zip can additionally carry frontend screens (case
tabs, task forms, widgets, pages) that render inside GZAC as sandboxed iframes.

Everything a plugin may do is declared in its `manifest.json` and granted per configuration by an
administrator. Design for that: declare the minimum you need — every entry appears on the
acceptance screen, and an over-broad request is a reason not to install your plugin.

## Prerequisites

- **Node.js 22+** (`.nvmrc` in `plugin-host/` has the pinned version)
- The Wasm toolchain (`extism-js` + `binaryen`) installs itself on first build
- For in-repo development: `cd plugin-host && npm run dev` gives you a running host on
  `http://localhost:8090` (see the [plugin-host README](../README.md))

## 1. Scaffold a project

`valtimo-plugin-init` writes a complete, buildable project:

```bash
# from plugin-host/, with the SDK built (npm run setup does that)
node plugin-sdk/bin/valtimo-plugin-init.mjs ~/work/my-plugin --sdk "file:$PWD/plugin-sdk"

# non-interactive, with chosen frontend bundles
node plugin-sdk/bin/valtimo-plugin-init.mjs ~/work/my-plugin --yes \
  --bundles config,case-tab,page --sdk "file:$PWD/plugin-sdk"
```

From a published SDK the same command is
`npx --package @valtimo/plugin-sdk valtimo-plugin-init my-plugin`.

The wizard asks for the plugin identity (id, version, per-locale name/description, provider),
whether to add an event handler, and which of the six frontend bundle types to generate
(`--bundles all` / `none` / a comma list; default is `config` alone):

| Bundle type | Renders | Backend counterpart generated |
|---|---|---|
| `config` | The configuration form in the admin activation modal | `configurationSchema` in the manifest |
| `process-link-action` | The action-input form in the process-link modeler | – |
| `case-tab` | A tab on the case detail page | shared `request()` handler + `frontend_data` |
| `case-widget` | A card on a widgets tab | shared `request()` handler + `frontend_data` |
| `task-form` | The form for a user task | `submit()` hook (`submitHandler: true`) |
| `page` | A routed page in the navigation menu | shared `request()` handler + `frontend_data` |

The generated project builds and packs without edits:

```bash
cd ~/work/my-plugin
npm run build:pack        # -> dist/my-plugin-0.1.0.zip
```

## 2. Project anatomy & manifest

```
my-plugin/
├── manifest.json          # identity, translations, permissions, actions, bundles, events
├── package.json           # depends on @valtimo/plugin-sdk; build:pack script
├── src/plugin.ts          # ALL backend logic — actions, events, requests, submit hooks
└── frontend/              # one .html + .tsx pair per frontend bundle
```

```json
{
  "pluginId": "my-plugin",
  "version": "0.1.0",
  "provider": "Acme",
  "translations": {
    "en": { "name": "My plugin", "description": "Does a thing.", "tab.title": "My tab" },
    "nl": { "name": "Mijn plugin", "description": "Doet een ding.", "tab.title": "Mijn tabblad" }
  },
  "compatibility": { "minGzacVersion": "13.0.0" },
  "permissions": {
    "capabilities": ["gzac_api", "log"],
    "endpoints": [{ "method": "GET", "pattern": "/api/v1/document/*" }],
    "egress": ["api.example.com"]
  },
  "eventSubscriptions": ["com.ritense.valtimo.document.created"],
  "actions": [
    {
      "key": "my-action",
      "title": "My action",
      "description": "Builds a thing from the case.",
      "activityTypes": ["SERVICE_TASK_START"],
      "properties": [{ "key": "greeting", "type": "string", "required": true }],
      "outputs": ["summary", "total"]
    }
  ],
  "frontendBundles": [
    { "type": "case-tab", "path": "/bundles/case-tab.html", "title": "My tab" }
  ],
  "configurationSchema": { "type": "object", "properties": { } }
}
```

### Actions (`actions[]`)

| Field | Meaning |
|---|---|
| `key` | Identifies the action; the URL segment GZAC invokes (`…/actions/{key}`) and the value handed to your `action(key, …)` registration. |
| `title` / `description` | Shown in the process-link "choose action" step. |
| `activityTypes` | Where the action may be linked (e.g. `SERVICE_TASK_START`). GZAC only offers the action on matching activities — an action can never be bound where it cannot run. |
| `properties` | The action's input fields: `{key, type, required?}`. The admin fills them in the process link (a `process-link-action` bundle can render a richer form); values arrive resolved in `ActionInput.properties`. |
| `outputs` | Keys your `result` object exposes. Declaring them gives the admin a guided output-mapping step (dropdown of these keys → `doc:`/`pv:`/`case:` targets). **Contract:** a completed action must return a `result` containing *every* declared key — missing keys fail the invocation; `null` values are fine (the runtime serialises `undefined` as `null`). |

### Frontend bundles (`frontendBundles[]`)

| Field | Meaning |
|---|---|
| `type` | One of the six types above. |
| `path` | Bundle entry point under the package (e.g. `/bundles/case-tab.html`); the host serves it at `GET /plugins/{id}/{version}` + path. |
| `key` | Distinguishes multiple bundles of one type (e.g. three task forms). Optional for a plugin's sole bundle of a type. |
| `title` | Label in admin pickers. **For `page` bundles it is a translation key**, resolved against your locale buckets to build the menu label; every other type renders it literally. |
| `icon` | `page` bundles only — the menu icon class (e.g. `icon mdi mdi-view-dashboard`). |
| `submitHandler` | `task-form` bundles only — `true` invokes your `submit(key, …)` hook during submission (Level 1); the hook key equals the bundle's `key`. |
| `activityTypes` | `task-form` bundles: where the form may be linked (typically `USER_TASK_CREATE`). |

### Validation rules

All enforced by the shared validator at pack time *and* at upload:

- **No top-level name/description** — they live per locale under `translations`; every declared
  locale must carry both. Additional keys in a bucket are free-form strings for the frontend
  SDK's `t(key)`.
- **Identity charset**: `pluginId` is lowercase, 1–64 chars, letters/digits at both ends,
  `.`/`-`/`_` inside; `version` additionally allows uppercase and `+` (semver metadata). These
  become directory names and URL segments, so nothing path-like is accepted.
- **`compatibility` bounds must be strict semver** (`13.0.0`, not `13` or `v13.0.0`).
- **`permissions.endpoints` requires the `gzac_api` capability**, and `permissions.egress`
  requires `http_request`.
- **A logo** is a `logo.svg`/`.png`/`.jpg`/`.jpeg` next to `manifest.json` — the pack tool picks
  it up automatically; GZAC shows it in the plugin pickers.
- The pack tool stamps `sdkVersion` into the packed manifest; you never set it by hand.

### Configuration properties

`configurationSchema` is a JSON Schema; the admin's values are validated against it and arrive in
every handler as `input.configuration`. Two `x-` keywords change how GZAC treats a property:

- `"x-secret": true` — stored encrypted, masked in every API response, never round-tripped to
  the browser on edit.
- `"x-egress-target": true` (on a `"format": "uri"` string) — the value's origin joins the
  plugin's outbound allowlist. Use it for per-environment endpoints only the admin knows; fixed
  endpoints belong in `permissions.egress`.

## 3. Backend handlers (`src/plugin.ts`)

Everything imports from `@valtimo/plugin-sdk`. The build tool generates the Wasm exports
(`handle_action`, `handle_event`, `handle_request`, `handle_submit`) from your registrations —
you only write handlers. Two execution rules first:

- **Handlers look synchronous** — `gzacApi`, `httpRequest`, and `kv` return results directly
  (the host suspends the Wasm call). Real `async`/`await` does not settle inside the sandbox;
  you never need it.
- **Handlers must be idempotent** — event delivery is at-least-once, and calls for one
  configuration can run concurrently. A thrown exception becomes a structured error envelope
  (for actions: a BPMN error in the process), never a host crash.

### `action(key, handler)` — process service tasks

```ts
interface ActionInput {
  actionKey: string;
  configurationId: string;
  configuration: Record<string, unknown>;   // this configuration's properties
  processInstanceId: string;
  documentId: string;                        // the case document (business key)
  activityId: string;
  properties: Record<string, unknown>;       // the process link's action inputs, resolved
}
interface ActionOutput {
  status: "completed" | "error";
  variables?: Record<string, unknown>;       // applied as process variables
  result?: unknown;                          // fed to the link's output mappings (see outputs)
  errorCode?: string;                        // BPMN error code on status: "error"
  errorMessage?: string;
}
```

### `onEvent(handler)` — platform events

Delivered for the configuration's **granted** subscriptions only (a flattened CloudEvent):

```ts
interface EventInput {
  type: string; id: string; source: string; time?: string;
  userId?: string; roles?: string[];
  resultType?: string; resultId?: string; result?: unknown;   // the event payload
  configuration: Record<string, unknown>;
}
interface EventOutput { status: "completed" | "ignored" | "error"; errorCode?: string; errorMessage?: string; }
```

Multiple `onEvent` registrations all run per event; returning nothing counts as completed. Event
types are the platform's CloudEvent `type` values (e.g. `com.ritense.valtimo.document.created`,
`…task.completed`); anything GZAC's outbox publishes can be subscribed to.

### `request(path, handler)` — serving your own frontend

Called through the host's public `/data` route (requires the `frontend_data` grant; the host has
already introspected the caller's user token before your handler runs):

```ts
interface RequestInput {
  method: string; path: string;
  query?: Record<string, string>;
  body?: unknown;
  configurationId?: string;
  configuration: Record<string, unknown>;
  context?: Record<string, unknown>;         // what the iframe passed along (documentId, …)
}
interface RequestOutput { status: number; headers?: Record<string, string>; body?: unknown; }
```

Treat `RequestInput` as untrusted (any authenticated user of the GZAC instance can reach it) and
never return data you would not show every user of the configuration; use `gzacApi.asUser` when
the response must respect the caller's permissions.

### `submit(key, handler)` — task-form hook (Level 1)

```ts
interface SubmitInput {
  submitKey: string;
  configurationId: string;
  configuration: Record<string, unknown>;
  taskId?: string; processInstanceId?: string; documentId?: string;   // backend-supplied, authoritative
  submission: Record<string, unknown>;        // the raw form data
}
interface SubmitOutput {
  status: "completed" | "error";
  variables?: Record<string, unknown>;        // process variables on completion
  documentContent?: Record<string, unknown>;  // JSON-pointer path → value, applied to the case document
  errorCode?: string; errorMessage?: string;
  fieldErrors?: Record<string, string>;       // field → message, rendered inline on the form
}
```

`status: "error"` means GZAC does **not** complete the task.

### Host functions

| API | Capability | Returns | Notes |
|---|---|---|---|
| `gzacApi.{get,post,put,delete}(path, body?, headers?)` | `gzac_api` | `GzacApiResponse = { status, headers, body }` | Calls GZAC as the **service token** — reach is exactly the granted endpoint list (an ungranted path yields a 403-shaped response). Your own `Authorization` header is stripped. |
| `gzacApi.asUser.*` | `gzac_api` | same | As the **logged-in user** (available in `request()`/`submit()` flows where a user token exists) — bounded by that user's permissions ∩ the endpoint list. |
| `httpRequest.{get,post,put,delete}(url, …)` | `http_request` | `HttpRequestResponse = { status, headers, body }` | Only declared egress origins; HTTPS by default; redirects re-validated; every call logged (redacted) for the admin. Timeout 30 s, max 60 s. |
| `kv.get(key)` | `kv` | `KvGetResult = { found, value }` | Per-configuration store; `found: false` ≠ stored `null`. Keys ≤ 256 chars. Also `kv.set(key, value)`, `kv.delete(key): boolean`, `kv.list(prefix?): string[]`. Entries persist until you delete them. |
| `log.{debug,info,warn,error}(message, data?)` | `log` | `void` | Structured entries in the admin Logs modal; messages truncated at 4 KB; retained 30 days by default. Fire-and-forget. |
| `config.get()` | – | the configuration's properties | Same object as `input.configuration`. |

A host function invoked without its capability granted returns a structured
`Capability 'X' not granted for this configuration` error — deterministic, never silent access.

## 4. Frontend bundles

A bundle is a `frontend/*.html` file whose `<script src="./x.tsx">` the pack tool compiles with
esbuild. Bundles render at an **opaque origin** inside a sandboxed iframe and **never hold a
token** — all data access goes through the SDK's parent-proxy, and the parent enforces the
configuration's endpoint allowlist plus the user's own permissions.

```tsx
import { ValtimoPluginSDK } from "@valtimo/plugin-sdk/frontend";

const sdk = new ValtimoPluginSDK();          // production tip: { parentOrigin: "https://valtimo.example.com" }
sdk.ready().then(() => {                     // resolves once translations + parent init arrived
  const ctx = sdk.getContext();
  sdk.callValtimo("GET", `/api/v1/document/${ctx.documentId}`)     // as the logged-in user
    .then(({ status, body }) => render(body));
  sdk.getPluginData("/summary", { detail: "full" })                // your request() handler
    .then(({ status, body }) => renderSummary(body));
});
```

### SDK surface

| Member | Purpose |
|---|---|
| `ready(): Promise<void>` | Resolves when the manifest (translations) is fetched **and** the parent's `init` arrived — mount your UI inside it so the first render uses the right locale. |
| `getContext()` / `onContext(h)` | The surface context (table below). |
| `getLocale()` / `t(key, fallback?)` | Active UI language and translation lookup from `manifest.translations` (falls back to `en`, then the key). |
| `getTheme()` / `onThemeChanged(h)` | The hosting UI's Carbon theme, for matching light/dark styling. |
| `callValtimo(method, path, body?)` | GZAC API call as the logged-in user → `Promise<{status, body}>`. Paths must be GZAC API paths (`/api/…`); the parent rejects anything else. |
| `getPluginData(path, query?)` / `postPluginData(path, body?)` | Calls your `request()` handlers through the host's `/data` route → `Promise<{status, body}>`. |
| `submitTask(data)` | Task forms (Levels 0/1): hand the form data to GZAC → `Promise<{ok, errors?, fieldErrors?}>`; on `ok: false` render the errors, the form stays up. |
| `emit("taskCompleted", {})` | Level 2 only: tell the parent *you* completed the task (via `gzacApi.asUser`), so it closes and refreshes. |
| `emit("notification", {type, message})` | Toast in the hosting UI (`success`/`warning`/`error`/`info`). |
| `emit("navigate", {route})` | Ask the hosting UI to navigate. |
| `setConfiguration(valid, title, data)` / `onPrefillConfiguration(h)` / `onSave(h)` | The `config` bundle contract — next section. |
| `destroy()` | Detach listeners (hot-reload/dev). |

Context fields per surface (plus the base `pluginConfigurationId`/`pluginId` identifiers):

| Surface | Context |
|---|---|
| `case-tab`, `case-widget` | `documentId`, `caseDefinitionKey`, `caseDefinitionVersionTag` |
| `task-form` | `taskId`, `processInstanceId`, `documentId` |
| `page` | base identifiers only — a page is not case-bound |
| `config`, `process-link-action` | base identifiers; drive these via the contract below |

### The `config` bundle contract

A `config` bundle **is** the "Enter data" step of the activation modal — including the
configuration-name field, so your form controls the whole step:

1. On load, register `sdk.onPrefillConfiguration(({title, configuration}) => …)` — it fires in
   edit mode (and when a wizard step is revisited) with the current values. Secret properties
   arrive masked; treat an untouched masked value as "unchanged".
2. On **every change**, call `sdk.setConfiguration(valid, title, data)` — `valid` gates the
   modal's next/save button, `title` is the configuration name, `data` must satisfy your
   `configurationSchema` (GZAC validates it server-side on save).
3. Optionally register `sdk.onSave(…)` to flush pending state when the admin confirms.

A `process-link-action` bundle works the same way for an action's input form in the process-link
modeler: prefill in, `setConfiguration(valid, /* title unused */ "", properties)` out.

### Containment constraints

The bundle's CSP allows same-origin assets only — no third-party scripts, fonts, fetches, or form
posts; ship everything in the bundle. `getPluginData` requires the `frontend_data` capability;
`callValtimo` is pre-checked client-side against the granted endpoints and enforced server-side
regardless.

### Task forms: three levels

- **Level 0** — collect input, `sdk.submitTask({"pv:approved": true, "doc:/comment": text})`;
  value-resolver-prefixed keys become process variables (`pv:`, or unprefixed) and document
  values (`doc:`); GZAC completes the task. No backend code.
- **Level 1** — add `submitHandler: true` + a `submit()` hook to validate/transform; reject with
  `fieldErrors` and the form renders them inline.
- **Level 2** — drive completion yourself: `postPluginData` → `request()` handler →
  `gzacApi.asUser.post('/api/v1/task/{id}/complete')` (needs that endpoint granted), then
  `emit("taskCompleted", {})`.

## 5. Build, pack, upload

```bash
npm run build:pack                     # esbuild → extism-js → plugin.wasm → dist/<id>-<version>.zip
cd plugin-host && npm run plugin:upload -- ~/work/my-plugin/dist/my-plugin-0.1.0.zip
```

The zip contains `manifest.json`, `plugin.wasm`, the optional logo, and `frontend/**` — nothing
else is accepted by the host. Uploads also happen through the admin UI, a boot-time pre-install
directory, or a deployment descriptor (see [Auto-deployment](./auto-deployment.md)).

**Versioning is immutable.** A published `pluginId@version` means exactly those bytes: uploading
different content under an existing version is refused, and replacing it takes an explicit
admin-confirmed overwrite that re-reviews your requested permissions. Ship changes as a new
version — old and new versions run side by side, because published case definitions stay pinned
to the version they were built with. During development, iterate by confirming the overwrite in
the upload dialog (an identical re-upload is a friendly no-op), or bump the version.

**Permissions changes never apply silently.** A new version that declares more endpoints, events,
capabilities, or egress gets them only after an administrator re-accepts. Dispatch, allowlists,
and egress all follow the *granted* set, not the manifest.

## 6. Testing and reference

- `sample-plugins/case-summary/` is the reference plugin: every capability, all bundle types,
  all three task-form levels, declared action outputs, i18n, logo.
- [`TESTING.md`](../TESTING.md) explains the test layers and which test to write when.
- [SDK README](../plugin-sdk/README.md) — full API and CLI reference
  ([`valtimo-plugin-init`](../plugin-sdk/README.md#valtimo-plugin-init)).
- [Host README](../app/README.md) — the routes and checks your plugin runs under.
