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
**Permissions** step the administrator reviews, and an over-broad request is a reason not to
install your plugin.

## Prerequisites

Plugin development is standalone: you build against the published
[`@valtimo/plugin-sdk`](https://www.npmjs.com/package/@valtimo/plugin-sdk) npm package and test
against a plugin host running as a Docker container — the Valtimo repository is not involved.

- **Node.js 18+** — enough for the SDK CLIs and the build; only the host itself needs Node 22,
  and you run that as a container
- The Wasm toolchain (`extism-js` + `binaryen`) installs itself on first build, cached per user
- **To run your plugin:** a plugin host connected to a GZAC instance — run the
  `valtimo/plugin-host` image with its PostgreSQL
  ([host configuration & deployment](./host-configuration-and-deployment.md)) and connect it from
  the admin UI ([Add a plugin host](../../documentation/configuration-guides/plugins/external-plugins/add-a-plugin-host.md))

## 1. Scaffold a project

`valtimo-plugin-init` writes a complete, buildable project:

```bash
npx --package @valtimo/plugin-sdk valtimo-plugin-init my-plugin

# non-interactive, with chosen frontend bundles
npx --package @valtimo/plugin-sdk valtimo-plugin-init my-plugin --yes \
  --bundles config,case-tab,page
```

(Contributing to Valtimo itself? The [plugin-host README](../README.md) covers scaffolding
against the in-repo SDK.)

The wizard asks for the plugin identity (id, version, provider), the locales, a name and
description for the primary locale (other locale buckets start as translate-me placeholders),
whether to add an event handler, and which of the six frontend bundle types to generate
(`--bundles all` / `none` / a comma list; default is `config` alone):

| Bundle type | Renders | Backend counterpart generated |
|---|---|---|
| `config` | The settings form in the admin's **Configure plugin** modal | `configurationSchema` in the manifest |
| `process-link-action` | The action-input form in the process-link modeler | – |
| `case-tab` | A tab on the case detail page | shared `request()` handler + `frontend_data` |
| `case-widget` | A card on a widgets tab | shared `request()` handler + `frontend_data` |
| `task-form` | The form for a user task | `submit()` hook (`submitHandler: true`) |
| `page` | A routed page in the navigation menu | shared `request()` handler + `frontend_data` |

The generated project builds and packs without edits:

```bash
cd my-plugin
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

### The manifest

`manifest.json` is the plugin's complete self-description: identity, translations, permissions,
actions, frontend bundles, event subscriptions, and the configuration schema. GZAC reads it at
discovery, and everything the administrator sees and grants comes from here. A filled-in example,
broken down section by section below:

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
    "capabilities": ["gzac_api", "http_request", "log"],
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
| `activityTypes` | Where the action may be linked (e.g. `SERVICE_TASK_START`). GZAC's modeler only offers the action on matching activities. |
| `properties` | The action's input fields: `{key, type, required?}`. The admin fills them in the process link (a `process-link-action` bundle can render a richer form); values arrive resolved in `ActionInput.properties`. |
| `outputs` | Keys your `result` object exposes. Declaring them gives the admin a guided output-mapping step (dropdown of these keys → `doc:`/`pv:`/`case:` targets). **Contract:** a completed action must return a `result` containing *every* declared key — missing keys fail the invocation; `null` values are fine (the runtime serialises `undefined` as `null`). |

### Frontend bundles (`frontendBundles[]`)

| Field | Meaning |
|---|---|
| `type` | One of the six types above. |
| `path` | Bundle entry point; must start with `/bundles/`, which maps onto the package's `frontend/` directory (`/bundles/case-tab.html` → `frontend/case-tab.html`). The host serves it at `GET /plugins/{id}/{version}/bundles/…`. |
| `key` | Distinguishes multiple bundles of one type (e.g. three task forms). Optional for a plugin's sole bundle of a type. |
| `title` | Label in admin pickers. **For `page` bundles it is a translation key**, resolved against your locale buckets to build the menu label; every other type renders it literally. |
| `icon` | `page` bundles only — the menu icon class (e.g. `icon mdi mdi-view-dashboard`). |
| `submitHandler` | `task-form` bundles only — `true` invokes your `submit(key, …)` hook during submission (Level 1); the hook key equals the bundle's `key`. |
| `activityTypes` | `task-form` bundles: declared intent (typically `USER_TASK_CREATE`) — **not yet enforced**; the modeler currently offers every task-form bundle on user tasks. |

### Manifest rules

The pack tool validates the manifest (and the host re-checks at upload), so mistakes surface on
your machine, not the administrator's. Write it to these rules:

- **Put name and description per locale under `translations`** — there are no top-level fields,
  and every declared locale must carry both. Additional keys in a bucket are free-form strings
  for the frontend SDK's `t(key)`.
- **Keep the identity path-safe**: `pluginId` is lowercase, 1–64 chars, letters/digits at both
  ends, `.`/`-`/`_` inside; `version` additionally allows uppercase and `+` (semver metadata).
  These become directory names and URL segments, so nothing path-like is accepted.
- **Write `compatibility` bounds as strict semver** (`13.0.0`, not `13` or `v13.0.0`).
- **Declare capabilities consistently**: `permissions.endpoints` requires the `gzac_api`
  capability, and `permissions.egress` requires `http_request`.
- **Ship a logo** as `logo.svg`/`.png`/`.jpg`/`.jpeg` next to `manifest.json` — the pack tool
  picks it up automatically; GZAC shows it in the plugin pickers.
- **Leave `sdkVersion` out** — the pack tool stamps it from your project's resolved SDK.

### Configuration properties

`configurationSchema` is a JSON Schema; the admin's values are validated against it and arrive in
every handler as `input.configuration`. Two `x-` keywords change how GZAC treats a property:

- `"x-secret": true` — stored encrypted, omitted from every API response, never round-tripped
  to the browser on edit.
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
  (for actions: a failed invocation surfaced as a process incident), never a host crash.

### `action(key, handler)` — process service tasks

An action is the plugin's unit of process work: an administrator links it to a BPMN activity
(within the manifest entry's `activityTypes`), and GZAC invokes it when the process reaches that
activity. Your handler receives an `ActionInput` and returns an `ActionOutput` — `variables` land
in the process, `result` feeds the link's output mappings, and a thrown error or `status:
"error"` fails the invocation: GZAC raises a process **incident** carrying your
`errorCode`/`errorMessage` (deliberately not a BPMN error — boundary events cannot catch it):

```ts
action("my-action", (input: ActionInput) => {
  const summary = `${input.properties.greeting} for case ${input.documentId}`;
  return { status: "completed" as const, result: { summary, total: 1 } };
});
```

```ts
interface ActionInput {
  actionKey: string;
  configurationId: string;
  configuration: Record<string, unknown>;   // this configuration's properties
  processInstanceId: string;
  documentId: string;                        // the case document (business key); "" without one
  activityId: string;
  properties: Record<string, unknown>;       // the process link's action inputs, resolved
}
interface ActionOutput {
  status: "completed" | "error";
  variables?: Record<string, unknown>;       // applied as process variables
  result?: unknown;                          // fed to the link's output mappings (see outputs)
  errorCode?: string;                        // surfaced on the process incident
  errorMessage?: string;
}
```

### `onEvent(handler)` — platform events

React to things happening in the platform — a document created, a task completed — without any
process link: the host invokes your handler for every event whose type is among the
configuration's **granted** subscriptions. The handler receives the flattened CloudEvent:

```ts
interface EventInput {
  type: string; id: string; source: string; time?: string;
  userId?: string; roles?: string[];
  resultType?: string; resultId?: string; result?: unknown;   // the event payload
  configuration: Record<string, unknown>;
}
interface EventOutput { status: "completed" | "ignored" | "error"; errorCode?: string; errorMessage?: string; }
```

Multiple `onEvent` registrations all run per event; the last handler that returns a status
determines what is reported. Return `"ignored"` when a handler decides the event is not for it,
and nothing at all counts as `"completed"`. The status is purely diagnostic — no status triggers
a redelivery, and it only reaches the host's own process logs; for a failure the administrator
should see in the Logs modal, call `log.error(…)` (needs the `log` capability). Event types are
the platform's CloudEvent `type` values (e.g. `com.ritense.valtimo.document.created`,
`…task.completed`); anything GZAC's outbox publishes can be subscribed to.

### `request(path, handler)` — serving your own frontend

`request()` is how your own frontend bundles get data — an iframe's CSP allows no outside calls.
When a bundle calls `sdk.getPluginData("/summary")` or `postPluginData(…)` (see
[SDK surface](#sdk-surface)), the GZAC frontend forwards the call to the host's public `/data`
endpoint, which runs the handler registered for that path. Reaching your handler requires the
`frontend_data` grant, and the host has already introspected the caller's GZAC user token:

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
never return data you would not show every user of the configuration. When the handler itself
calls GZAC to build its response, prefer `gzacApi.asUser` over `gzacApi`: the call then runs
under the calling user's own permissions instead of the service token, so nobody can read more
through your plugin than they could directly.

### `submit(key, handler)` — task-form hook (Level 1)

Only relevant when a `task-form` bundle declares `submitHandler: true`
([task-form levels](#task-forms-three-levels)); the `key` equals that bundle's `key`. When the
user submits the form, GZAC calls this hook with the raw submission *before* completing the
task — the place to validate it (reject with `fieldErrors` and the form renders them inline) or
to transform loose form input into process variables and document content. Without the hook, the
form's data is applied as submitted (Level 0):

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
| `gzacApi.get/delete(path, headers?)`, `gzacApi.post/put(path, body?, headers?)` | `gzac_api` | `GzacApiResponse = { status, headers, body }` | Calls GZAC as the **service token** — reach is exactly the granted endpoint list (an ungranted path yields a 403-shaped response). Your own `Authorization` header is stripped. |
| `gzacApi.asUser.*` | `gzac_api` | same | As the **logged-in user** — only in `request()` invocations, the one flow that carries a user token; anywhere else it returns a 401-shaped response. Bounded by that user's permissions ∩ the endpoint list. |
| `httpRequest.{get,post,put,delete}(url, …)` | `http_request` | `HttpRequestResponse = { status, headers, body }` | Only declared egress origins; HTTPS by default; redirects re-validated; every call logged (redacted) for the admin. Timeout 30 s. |
| `kv.get(key)` | `kv` | `KvGetResult = { found, value }` | Per-configuration store; `found: false` ≠ stored `null`. Keys ≤ 256 chars. Also `kv.set(key, value)`, `kv.delete(key): boolean`, `kv.list(prefix?): string[]`. Entries persist until you delete them. |
| `log.{debug,info,warn,error}(message, data?)` | `log` | `void` | Structured entries in the admin Logs modal; messages truncated at 4 KB; retained 30 days by default. Fire-and-forget. |
| `config.getAll()` / `config.get(key)` | – | all properties / one value | Same data as `input.configuration` (`getAll()` returns a copy of the full object). |

A host function invoked without its capability granted returns a structured
`Capability 'X' not granted for this configuration` error — deterministic, never silent access.

## 4. Frontend bundles

A bundle is a `frontend/*.html` file that references `<script src="x.bundle.js">`; the pack tool
compiles the matching source file (`x.tsx`, `.ts`, `.jsx`, or `.js`) into that bundle with
esbuild. Bundles render at an **opaque origin** inside a sandboxed iframe and **never hold a
token** — all data access goes through the SDK's parent-proxy, and the parent enforces the
configuration's endpoint allowlist plus the user's own permissions.

```tsx
import { ValtimoPluginSDK } from "@valtimo/plugin-sdk/frontend";

const sdk = new ValtimoPluginSDK();          // or: new ValtimoPluginSDK({ parentOrigin: "https://valtimo.example.com" })
sdk.ready().then(() => {                     // resolves once translations + parent init arrived
  const ctx = sdk.getContext();
  sdk.callValtimo("GET", `/api/v1/document/${ctx.documentId}`)     // as the logged-in user
    .then(({ status, body }) => render(body));
  sdk.getPluginData("/summary", { detail: "full" })                // your request() handler
    .then(({ status, body }) => renderSummary(body));
});
```

`parentOrigin` pins the browser origin of the Valtimo UI allowed to embed the bundle: messages
from any other origin are ignored, and nothing is ever posted elsewhere. Set it when you build
for one known installation; leave it unset for a bundle shipped to many installations — the SDK
then pins the origin of the first `init` message, after checking it against the host's frame
policy.

### SDK surface

| Member | Purpose |
|---|---|
| `ready(): Promise<void>` | Resolves when the manifest (translations) is fetched **and** the parent's `init` arrived (or a 2 s init timeout elapses, so a bundle still renders without a parent) — mount your UI inside it so the first render uses the right locale. |
| `getContext()` / `onContext(h)` | The surface context (table below). |
| `getLocale()` / `t(key, fallback?)` | Active UI language and translation lookup from `manifest.translations`. A locale without a bucket falls back to the whole `en` bucket; a key missing from the active bucket renders the fallback, then the key. |
| `getTheme()` / `onThemeChanged(h)` | The hosting UI's Carbon theme, for matching light/dark styling. |
| `callValtimo(method, path, body?, headers?)` | GZAC API call as the logged-in user → `Promise<{status, body}>`. Paths must be GZAC API paths (`/api/…`); the parent rejects anything else. |
| `getPluginData(path, query?)` / `postPluginData(path, body?)` | Calls your `request()` handlers through the host's `/data` route → `Promise<{status, body}>`. |
| `submitTask(data)` | Task forms (Levels 0/1): hand the form data to GZAC → `Promise<{ok, errors?, fieldErrors?}>`; on `ok: false` render the errors, the form stays up. |
| `emit("taskCompleted", {})` | Level 2 only: tell the parent *you* completed the task (via `gzacApi.asUser`), so it closes and refreshes. |
| `emit("notification", …)` / `emit("navigate", …)` | **Reserved** — defined in the message schema, but current GZAC frontends do not act on them. |
| `setConfiguration(valid, title, data)` / `onPrefillConfiguration(h)` | The `config` bundle contract — next section. |
| `destroy()` | Detach listeners (hot-reload/dev). |

Context fields per surface:

| Surface | Context |
|---|---|
| `case-tab`, `case-widget` | `pluginConfigurationId`, `documentId`, `caseDefinitionKey`, `caseDefinitionVersionTag` |
| `task-form` | `pluginConfigurationId`, `taskId`, `processInstanceId`, `documentId` |
| `page` | `configurationId` (note the different key) — a page is not case-bound |
| `config`, `process-link-action` | empty — drive these via the contract below |

### The `config` bundle contract

A `config` bundle **is** the **Enter data** step of the admin's **Configure plugin** modal
([admin guide](../../documentation/configuration-guides/plugins/external-plugins/configure-a-plugin.md)) —
including the configuration-name field, so your form controls the whole step:

1. On load, register `sdk.onPrefillConfiguration(({title, configuration}) => …)` — it fires in
   edit mode (and when a wizard step is revisited) with the current values. Secret properties are
   omitted from the prefill; leave a secret absent (or blank) in your `data` to keep the stored
   value.
2. On **every change**, call `sdk.setConfiguration(valid, title, data)` — `valid` gates the
   modal's next/save button, `title` is the configuration name, `data` must satisfy your
   `configurationSchema` (GZAC validates it server-side on save). GZAC saves the payload of your
   **last** call — there is no save-time callback (`onSave` is reserved; the `save` event is never
   sent), so keep the reported data current instead of deferring work to save time.

A `process-link-action` bundle works the same way for an action's input form in the process-link
modeler: prefill in, `setConfiguration(valid, "", properties)` out. A process link has nothing to
name, so the modeler reads only `valid` and `data` — pass an empty string for the title.

### Containment constraints

The bundle's CSP allows same-origin assets only — no third-party scripts, fonts, fetches, or form
posts; ship everything in the bundle. `getPluginData` requires the `frontend_data` capability;
`callValtimo` is pre-checked client-side against the granted endpoints and enforced server-side
regardless.

### Task forms: three levels

- **Level 0** — collect input, `sdk.submitTask({"pv:approved": true, "doc:/comment": text})`;
  value-resolver-prefixed keys become process variables (`pv:`, or unprefixed) and document
  values (`doc:`); GZAC completes the task. No plugin backend code needed.
- **Level 1** — add `submitHandler: true` + a `submit()` hook to validate/transform; reject with
  `fieldErrors` and the form renders them inline.
- **Level 2** — drive completion yourself: `postPluginData` → `request()` handler →
  `gzacApi.asUser.post('/api/v1/task/{id}/complete')` (needs that endpoint granted), then
  `emit("taskCompleted", {})`.

## 5. Build, pack, upload

```bash
npm run build:pack                     # esbuild → extism-js → plugin.wasm → dist/<id>-<version>.zip
```

The zip contains `manifest.json`, `plugin.wasm`, the optional logo, and `frontend/**` — nothing
else is accepted by the host. Get it onto a host through the admin UI (**Admin → Plugins →
Upload plugin**, [admin guide](../../documentation/configuration-guides/plugins/external-plugins/upload-a-plugin.md)),
the host's boot-time
[pre-install directory](./host-configuration-and-deployment.md#shipping-plugins-with-the-host),
or a deployment descriptor ([Auto-deployment](./auto-deployment.md)).

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

- [`sample-plugins/case-summary/`](../sample-plugins/case-summary/) is the reference plugin:
  every capability, all bundle types, all three task-form levels, declared action outputs, i18n,
  logo.
- [SDK README](../plugin-sdk/README.md) — full CLI and toolchain reference
  ([`valtimo-plugin-init`](../plugin-sdk/README.md#valtimo-plugin-init)).
- [Host README](../app/README.md) — the routes and checks your plugin runs under.
- Contributing to the plugin system itself? [`TESTING.md`](../TESTING.md) explains its test
  layers.
