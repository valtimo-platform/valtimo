# External Plugin System — Complete Plan (v11)

## 1. Terminology

| Term | Meaning |
|------|---------|
| Plugin (existing) | Current build-time plugins (Java annotations, Angular components). Unchanged. All existing names, paths, tables, annotations stay as-is. |
| External Plugin | New external plugins. Backend logic runs as a sandboxed JavaScript/TypeScript Wasm module in the Plugin Host, or as a standalone URL Plugin. |
| External Plugin Host | Node.js service embedding the Extism WebAssembly runtime. Loads `.wasm` plugin modules with true sandbox isolation. Runs as a Docker sidecar to GZAC. |
| URL Plugin | Standalone service at a URL conforming to the external plugin contract. Any tech stack. No sandbox — trust is established out-of-band. |
| External Plugin Configuration | An instance of a configured external plugin (credentials, settings). Multiple allowed per external plugin definition. Each configuration carries its own credentials, permissions, and event subscriptions. |

**No renames. No breaking changes.** The existing plugin system is untouched. The new system lives entirely under the `external-plugin` / `ExternalPlugin` namespace.

**v1 scope: JavaScript/TypeScript only.** Hosted plugins are written in JS/TS and compiled to Wasm via Extism's JS PDK (QuickJS-ng-based). The architecture supports adding Rust, Go, and other language SDKs later without changes to the host or GZAC integration.

## 2. Why Extism (WebAssembly)

PF4J provides ClassLoader isolation — this prevents dependency conflicts but offers **zero security isolation**. A PF4J plugin runs in the same JVM and has full access to filesystem, network, memory, system calls, and can terminate the host process. There is no sandbox to escape because there is no sandbox.

Extism embeds a WebAssembly runtime (Wasmtime) that provides **true capability-based isolation**:

- **Memory**: Each plugin runs in isolated linear memory. Cannot access host memory.
- **Filesystem**: No access unless the host explicitly grants it via host functions.
- **Network**: No access unless the host explicitly grants it via host functions.
- **System calls**: None. Wasm has no syscall interface by default.
- **Other plugins**: Complete isolation. Plugins cannot see or affect each other.
- **Host process**: Cannot terminate, cannot access environment variables, cannot use eval or require.

The plugin can **only** call functions that the host explicitly exports. This is a fundamental property of the WebAssembly execution model, not a runtime feature that can be bypassed.

**Trade-off**: Plugin developers write JavaScript/TypeScript which is compiled to WebAssembly via `extism-js` (Extism's QuickJS-ng-based JS-to-Wasm compiler). This is a build step, not a runtime concern — the developer experience is writing normal JS/TS. Frontend bundles are unaffected — they still run in iframe sandboxes.

**Known limitations**: Wasm sandbox escapes via JIT compiler bugs have occurred (e.g. CVE-2026-34971 in Wasmtime, ARM64 heap access). These are rare, quickly patched, and require sophisticated exploitation. Defense-in-depth: the Plugin Host itself runs in a Docker container with restricted capabilities.

## 3. Hosting Modes

| | External Plugin Host (Extism) | URL Plugin |
|---|---|---|
| Runtime | Node.js + Extism/Wasmtime | Any HTTP service |
| Backend | `.wasm` module (sandboxed) | Any tech stack (not sandboxed) |
| Frontend | Bundles/HTMX served from host | Bundles/HTMX served from plugin URL |
| Isolation | Wasm sandbox (memory, fs, network) | Process-level (separate service) |
| Plugin languages | JavaScript/TypeScript (v1) | Anything |
| Contract | Same manifest | Same manifest |
| Trust model | Untrusted code safe by default | Trust established out-of-band |
| Configuration model | Host injects config per-call; Wasm is stateless | GZAC sends config per-call by default (stateless); plugin may opt into push-based storage |

One external plugin version at a time per host or URL. No replication across hosts.

## 4. Configuration Model

A single plugin definition can have **multiple configurations**. For example, a "risk-assessment" plugin might have Config A with `apiKey=key1` for tenant X and Config B with `apiKey=key2` for tenant Y. Every runtime invocation — actions, events, API calls, page renders — must know which configuration applies.

### 4.1 Configuration Context Per Call

Every call into a plugin includes the configuration context:

```json
{
  "configurationId": "aaaaaaaa-...",
  "configuration": {
    "apiKey": "decrypted-value",
    "baseUrl": "https://risk-a.example.com",
    "retryCount": 3
  }
}
```

This appears in every Wasm function input (`handle_action`, `handle_event`, `handle_request`, `render_page`) and in every HTTP call to URL plugins.

The plugin code is **stateless with respect to configuration** — it receives everything it needs per invocation. The SDK's `config.getAll()` reads from this injected context, not from a separate host function call or persistent store.

### 4.2 How Configuration Flows Per Hosting Mode

**Hosted plugins (Wasm):**

1. On activation, GZAC sends the decrypted configuration to the Plugin Host (section 6.9)
2. The host stores `configId → decrypted properties` in memory
3. On each call (action, event, request, page render), the host injects the configuration into the Wasm function input
4. The Wasm module reads it via the SDK — it never persists configuration itself
5. On configuration update, GZAC pushes updated properties to the host

**URL plugins (default — stateless):**

1. Every HTTP call from GZAC includes the full decrypted configuration in the request body
2. The plugin uses the provided configuration for that specific call
3. The plugin does not need to store configuration — it receives it fresh each time

```
POST {pluginBaseUrl}/actions/{actionKey}
Headers: Authorization: Bearer <service-token-for-config-A>
Body: {
  "configurationId": "config-uuid-A",
  "configuration": { "apiKey": "key1", "baseUrl": "https://..." },
  "processInstanceId": "...",
  "documentId": "...",
  "properties": { ... }
}
```

**URL plugins (opt-in push-based):**

For plugins that prefer to manage their own configuration store (e.g. for performance or architectural reasons), the manifest includes `"configurationDelivery": "push"`:

1. On activation, GZAC pushes configuration: `POST {pluginBaseUrl}/configurations` with `{ "configurationId": "...", "properties": {...} }`
2. On update, GZAC pushes again: `PUT {pluginBaseUrl}/configurations/{configId}`
3. On deactivation, GZAC deletes: `DELETE {pluginBaseUrl}/configurations/{configId}`
4. Subsequent calls include only `configurationId`, not the full configuration
5. The plugin is responsible for persisting configuration, surviving restarts, etc.

Default is stateless (no `configurationDelivery` field or `"configurationDelivery": "inline"`). Push-based is opt-in.

### 4.3 Events with Multiple Configurations

When a plugin definition has multiple active configurations that subscribe to the same event type:

1. Each configuration has its own RabbitMQ queue (`external-plugin.{configId}`)
2. The event is delivered to **each queue independently**
3. The host (or URL plugin) processes each delivery with the corresponding configuration context

Example: "risk-assessment" has Config A and Config B, both subscribing to `DocumentCreated`.

```
DocumentCreated event published
  → routed to queue "external-plugin.{config-A-id}"
  → routed to queue "external-plugin.{config-B-id}"

Host consumes from both queues:
  → calls handle_event with config A's credentials/settings
  → calls handle_event with config B's credentials/settings
```

Each invocation is independent. The same `.wasm` module is called twice with different configuration payloads.

## 5. External Plugin Manifest

`GET /plugin-manifest`

```json
{
  "pluginId": "risk-assessment",
  "version": "1.2.0",
  "name": "Risk Assessment",
  "description": "Automated risk scoring for cases",
  "provider": "Acme Corp",
  "compatibility": {
    "minGzacVersion": "12.0.0",
    "maxGzacVersion": "14.0.0"
  },
  "configurationDelivery": "inline",
  "configurationSchema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "required": ["apiKey", "baseUrl"],
    "properties": {
      "apiKey": { "type": "string", "title": "API Key", "x-secret": true },
      "baseUrl": { "type": "string", "title": "Base URL", "format": "uri" },
      "retryCount": { "type": "number", "title": "Retry Count", "default": 3 }
    },
    "additionalProperties": false
  },
  "permissions": {
    "managementEndpoints": [
      { "method": "POST", "pattern": "/api/management/v1/form" }
    ],
    "userEndpoints": [
      { "method": "GET", "pattern": "/api/v1/document/{documentId}" }
    ],
    "events": [
      "DocumentCreated",
      "DocumentAssigned"
    ],
    "hostCapabilities": [
      "http-outbound",
      "kv-store"
    ]
  },
  "frontendBundles": [
    {
      "type": "config",
      "path": "/bundles/config.js"
    },
    {
      "type": "process-link-action",
      "key": "send-notification",
      "title": "Send Notification",
      "activityTypes": ["SERVICE_TASK_START"],
      "path": "/bundles/send-notification-config.js"
    },
    {
      "type": "case-tab",
      "key": "risk-overview",
      "title": "Risk Overview",
      "path": "/bundles/risk-overview.js"
    },
    {
      "type": "case-widget",
      "key": "risk-score",
      "title": "Risk Score Widget",
      "path": "/bundles/risk-score.js"
    },
    {
      "type": "page",
      "key": "analytics-dashboard",
      "title": "Analytics",
      "menuIcon": "carbon:analytics",
      "menuPosition": "after:cases",
      "renderMode": "bundle",
      "path": "/bundles/analytics.js"
    },
    {
      "type": "page",
      "key": "settings-dashboard",
      "title": "Settings",
      "menuIcon": "carbon:settings",
      "menuPosition": "after:analytics-dashboard",
      "renderMode": "htmx",
      "path": "/pages/settings"
    }
  ],
  "actions": [
    {
      "key": "send-notification",
      "title": "Send Notification",
      "description": "Sends a notification",
      "activityTypes": ["SERVICE_TASK_START"],
      "properties": [
        { "key": "recipient", "type": "string", "required": true },
        { "key": "template", "type": "string", "required": true }
      ]
    }
  ]
}
```

Notes:

- `configurationSchema` is **full JSON Schema**. Secrets marked via `x-secret` extension keyword.
- `configurationDelivery`: `"inline"` (default, can be omitted) sends full config with every call. `"push"` means the plugin manages its own config store and GZAC pushes on activation/update. Only relevant for URL plugins — hosted plugins always receive config inline via the host.
- `maxGzacVersion` optional — omit if plugin accepts any future version.
- Bundle paths relative to plugin base URL.
- Page bundles have `renderMode`: `"bundle"` (JS iframe) or `"htmx"` (server-rendered HTML iframe). The `path` for HTMX pages points to an HTML endpoint served by the host on behalf of the plugin.
- `permissions.hostCapabilities` declares which host functions the plugin needs (e.g. `http-outbound` for making HTTP calls via the host, `kv-store` for key-value storage). Admin must grant these during activation. GZAC API access is controlled exclusively by the endpoint allowlist (section 11.3), not by capabilities.
- Event types use the CloudEvent `type` strings matching what the outbox publishes (e.g. `"DocumentCreated"`, `"ZaakCreated"`, `"TaskCompleted"` — derived from `BaseEvent` subclass names).
- Health is managed by the host (Wasm modules don't have their own health endpoints).
- For hosted plugins, GZAC accesses the manifest via `GET {hostBaseUrl}/plugins/{pluginId}/plugin-manifest` (the host returns the stored manifest from the plugin package). For URL plugins, GZAC accesses `GET {pluginBaseUrl}/plugin-manifest` directly.

## 6. External Plugin Host

Lives in `plugin-host/` in the monorepo. Node.js + TypeScript + Fastify + Extism. Published as Docker image.

### 6.1 Architecture

The Plugin Host is a Node.js application that embeds the Extism WebAssembly runtime. It:

- Loads `.wasm` plugin modules into isolated Extism sandboxes
- Exposes an HTTP API that GZAC and frontends call
- Translates HTTP requests into Wasm function calls (JSON in, JSON out)
- Provides host functions that plugins can call for controlled access to external resources
- Serves frontend bundles and HTMX pages from plugin packages
- Consumes RabbitMQ events and delivers them to Wasm plugins
- Manages its own database for plugin key-value storage and API call logs
- Maintains a per-configuration map of decrypted properties and service tokens, injecting them into every Wasm call

```
┌─────────────────────────────────────────────────┐
│  Plugin Host (Node.js + Extism)                 │
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ Plugin A  │  │ Plugin B  │  │ Plugin C  │     │
│  │ (Wasm)   │  │ (Wasm)   │  │ (Wasm)   │     │
│  │ isolated  │  │ isolated  │  │ isolated  │     │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘     │
│        │              │              │           │
│  ┌─────┴──────────────┴──────────────┴─────┐    │
│  │         Host Functions (bridge)          │    │
│  │  http_request · log · config · kv_store  │    │
│  └──────────────────────────────────────────┘    │
│                                                 │
│  ┌──────────────────────────────────────────┐    │
│  │       Configuration Registry              │    │
│  │  configId → { properties, serviceToken }  │    │
│  │  In-memory, pushed from GZAC              │    │
│  └──────────────────────────────────────────┘    │
│                                                 │
│  ┌──────────────────────────────────────────┐    │
│  │           HTTP Layer (Fastify)            │    │
│  │  Management API · Plugin routing          │    │
│  │  Bundle serving · HTMX page serving       │    │
│  └──────────────────────────────────────────┘    │
│                                                 │
│  ┌──────────────────────────────────────────┐    │
│  │      RabbitMQ Consumer (amqplib)          │    │
│  │  Per-config queue → handle_event() call   │    │
│  └──────────────────────────────────────────┘    │
│                                                 │
│  ┌──────────────────────────────────────────┐    │
│  │      Host Database (PostgreSQL)           │    │
│  │  KV store · API call logs                 │    │
│  └──────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

### 6.2 Why Node.js

The entire external plugin developer experience is JavaScript/TypeScript:

- Plugin backend code: TypeScript
- Plugin frontend code: TypeScript
- Plugin build tooling: NPM
- Plugin Host: TypeScript

This means one language, one ecosystem, one toolchain. The team maintaining the Plugin Host and the SDKs works in a single language. The Extism Node.js SDK is well-maintained and actively developed.

Node.js also provides practical benefits for this use case: native async I/O for handling concurrent plugin calls and RabbitMQ consumption, and familiarity for the JS/TS developer audience.

### 6.3 Host Management API

All management endpoints require authentication via HMAC signature using the shared `SERVICE_TOKEN_SECRET`.

- `GET /api/host/plugins` — list loaded plugins with manifests
- `POST /api/host/plugins` — upload plugin package (`.zip` containing `.wasm` + frontend assets). Hot-reloads: drops old Wasm instance, loads new one.
- `DELETE /api/host/plugins/{pluginId}` — unload and remove plugin

### 6.4 Per Plugin (delegated by host)

- `GET /plugins/{pluginId}/plugin-manifest` — returns manifest (stored alongside wasm)
- `GET /plugins/{pluginId}/bundles/**` — frontend bundles (static files from package, public)
- `GET /plugins/{pluginId}/pages/**` — HTMX pages (calls Wasm function `render_page` with page key and context, returns HTML; public, served in iframe)
- `POST /plugins/{pluginId}/actions/{actionKey}` — calls Wasm function with action key and JSON payload (requires valid GZAC service token)
- `* /plugins/{pluginId}/api/**` — generic plugin API (calls Wasm function `handle_request` with method, path, headers, body; requires valid token)

All action/API calls include a `configurationId` header or body field. The host looks up the configuration from its in-memory registry and injects the decrypted properties into the Wasm function input.

### 6.5 Plugin Package Structure

```
risk-assessment-1.2.0.zip
├── manifest.json              # Plugin manifest
├── plugin.wasm                # JS/TS compiled to Wasm via extism-js
└── frontend/
    ├── config.js
    ├── risk-overview.js
    ├── risk-score.js
    ├── analytics.js
    └── pages/
        └── settings/
            ├── index.html     # HTMX page template
            └── partials/      # HTMX partial responses
                └── form.html
```

The `.wasm` module contains all backend logic (compiled from JS/TS). The `frontend/` directory contains static assets served directly by the host's HTTP layer.

### 6.6 Wasm Module Contract (Exported Functions)

Every plugin Wasm module must export these functions. **Every function receives the full configuration context** — the plugin is stateless with respect to configuration.

```
handle_action(json) -> json
  Input:  { "actionKey": "...", "configurationId": "...", "configuration": {...},
            "processInstanceId": "...", "documentId": "...",
            "activityId": "...", "properties": {...} }
  Output: { "status": "completed", "variables": {...} }

handle_request(json) -> json
  Input:  { "method": "GET", "path": "/api/something", "headers": {...}, "body": "...",
            "configurationId": "...", "configuration": {...} }
  Output: { "status": 200, "headers": {...}, "body": "..." }

render_page(json) -> json
  Input:  { "pageKey": "settings", "configurationId": "...", "configuration": {...},
            "context": {...}, "method": "GET",
            "path": "/form", "headers": {...}, "body": "..." }
  Output: { "status": 200, "contentType": "text/html", "body": "<html>..." }

handle_event(json) -> json
  Input:  { "type": "DocumentCreated", "data": {...}, "metadata": {...},
            "configurationId": "...", "configuration": {...} }
  Output: { "status": "processed" }

get_manifest() -> json
  Output: Full plugin manifest JSON
```

All communication is JSON strings in, JSON strings out — the standard Extism calling convention.

### 6.7 Host Functions (Provided to Plugins)

These are the capabilities the host grants to Wasm plugins. Each is opt-in via `permissions.hostCapabilities` in the manifest and must be approved by an admin during activation.

**`http_request(json) -> json`** — Make outbound HTTP requests (capability: `http-outbound`)

```
Input:  { "method": "GET", "url": "https://api.example.com/data", "headers": {...}, "body": "..." }
Output: { "status": 200, "headers": {...}, "body": "..." }
```

The host enforces an allowlist of permitted URL patterns per plugin configuration (configured during activation). Requests to non-allowed URLs are rejected.

**`gzac_api(json) -> json`** — Call GZAC API endpoints (always available for active plugins; no separate capability required)

```
Input:  { "method": "GET", "path": "/api/v1/document/{id}", "body": "..." }
Output: { "status": 200, "body": "..." }
```

Uses the plugin configuration's service token (managed by the host, never exposed to the Wasm module). Restricted to endpoints granted in `external_plugin_granted_endpoint` — enforced by GZAC's endpoint allowlist filter. The host knows which service token to use because the current call's `configurationId` maps to a specific token in the host's registry.

**`log(json)`** — Write to host logging (always available, no capability required)

```
Input:  { "level": "info", "message": "Processing document xyz" }
```

Logs are written to the host's structured logger (pino) with plugin ID and configuration ID prefix.

**`config_get(key) -> value`** — Read plugin configuration values (always available)

Returns configuration properties from the current call's injected `configuration` object. The SDK implements this by reading from the call input context — no separate host function call is needed at runtime. Secrets are already decrypted.

**`kv_get(key) -> value` / `kv_set(key, value)`** — Plugin-scoped key-value storage (capability: `kv-store`)

Backed by the host's own database (`external_plugin_kv_store` table). **Scoped to the plugin configuration** — KV keys are namespaced by `configurationId`. Plugins cannot access another configuration's data, even if they are the same plugin definition. Fast: single hop (Wasm → host → host database).

### 6.8 HTMX Page Serving

For plugins with `renderMode: "htmx"`, the host has two strategies:

**Static HTMX pages**: If the `frontend/pages/` directory in the plugin package contains HTML files, the host serves them directly as static files via `@fastify/static`. HTMX requests (`hx-get`, `hx-post`, etc.) from these pages are routed to the Wasm module's `render_page` function, which returns HTML partials.

**Dynamic HTMX pages**: The host calls `render_page` for the initial page load too, allowing fully server-rendered pages. The Wasm module generates the complete HTML response.

In both cases:

- HTMX library is served by the host at `/shared/htmx.min.js`
- `external-plugin-htmx-bridge.js` is served at `/shared/htmx-bridge.js`
- The bridge handles postMessage communication with the Angular parent and injects access tokens into HTMX requests
- The `configurationId` is included in the iframe URL as a query parameter, so the host can inject the correct configuration into `render_page` calls

### 6.9 Host-GZAC Authentication

The Plugin Host and GZAC authenticate to each other using a shared HMAC-SHA256 secret (`SERVICE_TOKEN_SECRET`), configured identically in both services.

**On startup**, the host:
1. Calls `POST /api/management/v1/external-plugin/host/register` on GZAC with an HMAC-signed request body containing host name, base URL, and a list of loaded plugin IDs
2. GZAC validates the HMAC signature, registers/updates the host record, and returns active plugin configurations with their service tokens and decrypted configuration properties
3. The host stores these in its in-memory configuration registry, keyed by `configurationId`

**Token lifecycle**: The host maintains a background refresh loop:
- Tracks expiry of each service token (1-hour TTL)
- Refreshes at 75% of TTL (~45 minutes) via `POST /api/v1/external-plugin/token/refresh` (authenticated with HMAC)
- On refresh failure, retries with exponential backoff (1s, 2s, 4s, 8s, max 60s)
- After 5 consecutive failures, marks affected plugin configuration as `DEGRADED` — action calls return 503

**Configuration updates**: When an admin updates a plugin configuration's properties in GZAC, GZAC pushes the updated decrypted properties to the host via `POST /api/host/configurations/{configId}`. The host updates its in-memory registry.

**On host restart**, the full startup flow re-executes, obtaining fresh tokens and configurations for all active plugin configurations.

**Per-plugin action/API calls** from GZAC to the host include the service token in the `Authorization` header and the `configurationId` in the request body. The host validates the token against its registry.

### 6.10 Hot-Reload

On plugin package upload:

1. Drop old Extism plugin instance (immediate — Wasm linear memory is freed)
2. Load new `.wasm` module into fresh Extism instance
3. Update frontend assets in serving directory
4. Update manifest in registry

Unlike ClassLoader-based hot-reload (PF4J), Wasm module reload is:

- **Instant**: No garbage collection pressure, no memory leaks
- **Clean**: Old module is simply dropped; new module starts with fresh memory
- **Safe**: No risk of lingering threads, zombie listeners, or corrupted shared state

Note: The same `.wasm` module serves all configurations of that plugin definition. Hot-reload replaces the module for all configurations simultaneously.

### 6.11 Resource Limits

The host enforces per-plugin resource limits via the Extism runtime:

- **Memory**: Maximum Wasm linear memory size (`max_pages` in Extism manifest, configurable, default 4096 pages = 256MB)
- **Execution time**: Per-call timeout (`timeout_ms`, configurable, default 30000ms)

These are enforced by the Extism/Wasmtime runtime, not by convention.

## 7. SDK

### 7.1 Backend Plugin SDK — `@valtimo/external-plugin-sdk`

NPM package. Written in TypeScript. Plugin developers write normal JS/TS and compile to Wasm using the included build tooling.

**Important: Execution model.** The Extism JS PDK uses QuickJS-ng, which has **no event loop**. All execution is synchronous. The SDK uses `async/await` syntax for ergonomic consistency with standard JS/TS, but there is **no concurrency**. `Promise.all([a(), b()])` executes `a` then `b` sequentially, not in parallel. This is a fundamental property of the QuickJS-ng runtime inside WebAssembly. Plugin developers should be aware of this — the SDK documentation covers it prominently.

**Supported JS/TS features:**
- ES2020 syntax (classes, destructuring, optional chaining, nullish coalescing, etc.)
- `async`/`await` (sequential execution, not concurrent)
- Pure npm packages when bundled (no Node.js built-ins, no browser APIs)
- Standard JSON, Math, Date, RegExp, Array, Map, Set, etc.

**Not available:**
- `setTimeout`, `setInterval`, `setImmediate`
- Node.js APIs (`fs`, `path`, `net`, `child_process`, etc.)
- Browser APIs (DOM, `window`, `localStorage`, `Worker`, `WebSocket`)
- Streams, dynamic imports, `eval`

**Plugin code example** (`src/plugin.ts`):

```typescript
import {
  action,
  onEvent,
  onRequest,
  renderPage,
  gzacApi,
  http,
  config,
  kv,
  log,
} from "@valtimo/external-plugin-sdk";

// Process link action
// config.getAll() reads from the injected configuration context — no network call
action("send-notification", async (input) => {
  const cfg = await config.getAll();
  const recipient = input.properties.recipient;
  const template = input.properties.template;

  // Call GZAC API via host function (uses this config's service token automatically)
  const doc = await gzacApi.get(`/api/v1/document/${input.documentId}`);

  // Make external HTTP call via host function
  const result = await http.post(cfg.baseUrl + "/send", {
    to: recipient,
    template: template,
    data: doc,
  });

  return { status: "completed", variables: { notificationId: result.id } };
});

// Event handler — receives the configuration for the specific config that subscribed
onEvent("DocumentCreated", async (event) => {
  log.info(`Document created: ${event.data.documentId}`);
  await kv.set(`last-doc-${event.data.caseDefinitionKey}`, event.data.documentId);
});

// Generic API endpoint
onRequest("GET", "/api/stats", async (req) => {
  const lastDoc = await kv.get("last-doc-loan-application");
  return { status: 200, body: { lastDocument: lastDoc } };
});

// HTMX page rendering
renderPage("settings", async (req) => {
  const cfg = await config.getAll();
  return {
    status: 200,
    contentType: "text/html",
    body: `
      <div>
        <h2>Plugin Settings</h2>
        <form hx-post="/plugins/risk-assessment/pages/settings/save" hx-swap="innerHTML">
          <label>API URL: <input name="baseUrl" value="${cfg.baseUrl}" /></label>
          <button type="submit">Save</button>
        </form>
      </div>
    `,
  };
});
```

**Build and package** (`package.json`):

```json
{
  "name": "risk-assessment-plugin",
  "version": "1.2.0",
  "scripts": {
    "build": "valtimo-plugin-build",
    "pack": "valtimo-plugin-pack"
  },
  "devDependencies": {
    "@valtimo/external-plugin-sdk": "^1.0.0"
  }
}
```

- `npm run build` — compiles TS to JS, then runs `extism-js` to produce `plugin.wasm`
- `npm run pack` — produces `risk-assessment-1.2.0.zip` (manifest.json + plugin.wasm + frontend/)

**SDK internals:**

- Wraps the Extism JS PDK (`@extism/js-pdk`)
- Registers exported functions (`handle_action`, `handle_request`, `render_page`, `handle_event`, `get_manifest`) and dispatches to user-registered handlers
- Provides typed wrappers around host function calls (`gzacApi`, `http`, `kv`, `log`)
- `config.getAll()` and `config.get(key)` read from the `configuration` field injected in the current call's input — zero overhead
- Includes `valtimo-plugin-build` CLI (wraps `extism-js` compiler)
- Includes `valtimo-plugin-pack` CLI (assembles the ZIP package)

**What the SDK hides from the developer:**

- Extism PDK internals (memory management, input/output buffers)
- Wasm module structure (exported functions, host function imports)
- JSON serialization/deserialization of the host protocol
- Build toolchain (QuickJS-ng compilation, Wizer pre-initialization)
- Configuration injection mechanics — the developer just calls `config.getAll()`

### 7.2 Frontend SDK — `@valtimo/external-plugin-frontend-sdk`

NPM package. Framework-agnostic vanilla TS. Frontend bundles run in iframes, not in Wasm.

```typescript
const sdk = new ValtimoExternalPluginSDK();

// Context — host sends context on load and on navigation
// Includes configurationId for plugin configuration context
sdk.onContext((ctx) => {
  // ctx.documentId, ctx.caseDefinitionKey, ctx.pluginConfigurationId, etc.
});

// User token (downscoped)
const token = await sdk.getAccessToken();
await sdk.gzacApi.get(`/api/v1/document/${ctx.documentId}`);

// Config prefill (for upgrade scenarios)
sdk.onPrefillConfiguration((oldConfig) => {
  // Populate form with old values
});

// Emit events to parent (typed protocol)
sdk.emit("resize", { height: 500 });
sdk.emit("configurationChanged", { valid: true, data: { ... } });
sdk.emit("navigate", { route: "/cases/123" });
sdk.emit("notification", { type: "success", message: "Saved" });

// Listen for events from parent
sdk.on("save", () => { /* trigger save */ });
sdk.on("themeChanged", (theme) => { /* adapt styling */ });
```

**PostMessage protocol** (used by both JS bundles and HTMX bridge):

| Direction | Event | Payload |
|-----------|-------|---------|
| Parent → Iframe | `init` | `{ context, accessToken, theme, locale }` |
| Parent → Iframe | `save` | `{}` |
| Parent → Iframe | `tokenRefresh` | `{ accessToken }` |
| Parent → Iframe | `themeChanged` | `{ theme }` |
| Iframe → Parent | `ready` | `{}` |
| Iframe → Parent | `resize` | `{ height }` |
| Iframe → Parent | `configurationChanged` | `{ valid, data }` |
| Iframe → Parent | `navigate` | `{ route }` |
| Iframe → Parent | `notification` | `{ type, message }` |

The `context` in the `init` event always includes `pluginConfigurationId` so the iframe knows which configuration it's operating under.

For HTMX pages, `external-plugin-htmx-bridge.js` (part of the frontend SDK) handles postMessage communication and injects the access token into HTMX requests via `htmx:configRequest`.

### 7.3 Project Scaffolding — `@valtimo/create-external-plugin`

```bash
npx @valtimo/create-external-plugin risk-assessment
```

Generates a complete project:

```
risk-assessment/
├── manifest.json
├── package.json
├── tsconfig.json
├── src/
│   └── plugin.ts          # Backend logic (starter template)
└── frontend/
    ├── config.js           # Configuration component (starter)
    └── pages/
        └── .gitkeep
```

## 8. Data Model

### 8.1 GZAC Database (existing PostgreSQL/MySQL database)

All JSON columns use Liquibase's `${jsonType}` property, which resolves to `JSONB` for PostgreSQL and `JSON` for MySQL — matching the existing migration pattern.

```sql
external_plugin_host (
  id                  UUID PK,
  name                VARCHAR(255),
  base_url            VARCHAR(1024),
  status              VARCHAR(32),        -- CONNECTED, UNREACHABLE
  last_health_check   TIMESTAMP
)

external_plugin_definition (
  id                  UUID PK,
  plugin_id           VARCHAR(255) NOT NULL UNIQUE,
  version             VARCHAR(64),
  name                VARCHAR(255),
  description         TEXT,
  provider            VARCHAR(255),
  min_gzac_version    VARCHAR(64),
  max_gzac_version    VARCHAR(64) NULL,
  config_schema       ${jsonType},
  configuration_delivery VARCHAR(32) DEFAULT 'inline',
  manifest_json       ${jsonType},
  host_id             UUID FK NULL,       -- NULL for URL plugins
  base_url            VARCHAR(1024) NOT NULL,
  status              VARCHAR(32)
)

external_plugin_configuration (
  id                  UUID PK,
  definition_id       UUID FK,
  title               VARCHAR(255),
  properties          ${jsonType},        -- encrypted via existing EncryptionService
  status              VARCHAR(32),        -- ACTIVE, DISABLED
  created_at          TIMESTAMP
)

external_plugin_granted_endpoint (
  id                  UUID PK,
  configuration_id    UUID FK,
  http_method         VARCHAR(10),
  endpoint_pattern    VARCHAR(512),
  active              BOOLEAN DEFAULT TRUE,
  granted_at          TIMESTAMP
)

external_plugin_granted_capability (
  id                  UUID PK,
  configuration_id    UUID FK,
  capability          VARCHAR(255),       -- "http-outbound", "kv-store"
  constraint_json     ${jsonType} NULL,
  active              BOOLEAN DEFAULT TRUE,
  granted_at          TIMESTAMP
)

external_plugin_event_subscription (
  id                  UUID PK,
  configuration_id    UUID FK,
  event_type          VARCHAR(512),       -- CloudEvent type string
  active              BOOLEAN DEFAULT TRUE
)

external_plugin_page (
  id                  UUID PK,
  definition_id       UUID FK,
  page_key            VARCHAR(255),
  title               VARCHAR(255),
  menu_icon           VARCHAR(255) NULL,
  menu_position       VARCHAR(255) NULL,
  render_mode         VARCHAR(32),        -- "bundle", "htmx"
  path                VARCHAR(1024)
)
```

**Capability constraint schemas:**

| Capability | `constraint_json` schema |
|---|---|
| `http-outbound` | `{ "allowedUrls": ["https://api.example.com/*", "https://*.internal.org/*"] }` |
| `kv-store` | `{ "maxKeys": 1000, "maxValueSizeBytes": 65536 }` (optional limits) |

**`process_link` table additions** (Liquibase changeset, added as nullable columns to the existing single-table-inheritance table):

```sql
ALTER TABLE process_link ADD COLUMN external_plugin_config_id UUID;
ALTER TABLE process_link ADD COLUMN external_plugin_action_key VARCHAR(255);
ALTER TABLE process_link ADD COLUMN external_plugin_action_properties ${jsonType};
```

**`base_url` for hosted plugins**: Computed as `{host.base_url}/plugins/{pluginId}` during discovery and stored in the definition. Updated if host base URL changes.

**`UNIQUE(plugin_id)`** means one version at a time globally. If two hosts load different versions of the same plugin, discovery detects the conflict and raises an error visible in the admin UI — the second version is rejected.

Notes:

- Properties encryption reuses the existing `EncryptionService` (AES/GCM/NoPadding, `valtimo.plugin.encryption-secret`). Schema `x-secret` fields are encrypted on save, decrypted on read.
- GZAC API access is controlled exclusively by `external_plugin_granted_endpoint`, not by capabilities. This avoids duplication.

**Relationships to existing models:**

- New `ProcessLink` discriminator `"external_plugin"` → `ExternalPluginProcessLink`
- Case tabs: use existing `CaseTabType.CUSTOM` with `contentKey = "external-plugin:{pluginId}:{tabKey}"`
- Case widgets: use existing `CUSTOM` discriminator with `componentKey = "external-plugin:{pluginId}:{widgetKey}"`
- Dynamic menu items for page bundles via `MenuService.registerAppendMenuItemsFunction()`

### 8.2 Plugin Host Database (separate PostgreSQL instance)

The Plugin Host has its own database for plugin-scoped data that doesn't need to live in GZAC's transactional database. This keeps KV operations fast (single hop: Wasm → host → local DB) and avoids polluting GZAC's database with high-write-volume logs.

```sql
external_plugin_kv_store (
  id                  UUID PK,
  plugin_config_id    UUID,       -- references GZAC configuration ID (not FK — separate DB)
  kv_key              VARCHAR(512),
  kv_value            TEXT,
  updated_at          TIMESTAMP,
  UNIQUE(plugin_config_id, kv_key)
)

external_plugin_api_log (
  id                  UUID PK,
  plugin_config_id    UUID,
  http_method         VARCHAR(10),
  endpoint            VARCHAR(512),
  status_code         INT,
  timestamp           TIMESTAMP,
  duration_ms         BIGINT,
  request_summary     TEXT NULL,
  error_message       TEXT NULL
)
```

API logs are queryable via the Plugin Host API (`GET /api/host/plugins/{pluginId}/log`), which GZAC's admin UI calls. KV data is scoped per `plugin_config_id` — two configurations of the same plugin definition have completely separate KV namespaces.

## 9. Discovery & Lifecycle

### 9.1 GZAC Version Endpoint

A new endpoint exposes the running GZAC version:

```
GET /api/v1/version → { "version": "13.1.3" }
```

The version is read from the application's build-info properties (populated by Gradle's `spring-boot-plugin` from `gradle.properties` `projectVersion`). Used by:
- Discovery polling to evaluate plugin compatibility
- Plugin Host to verify GZAC connectivity on startup
- Admin UI to display current version

### 9.2 Discovery via Polling

GZAC polls on configurable interval (default 60s):

- `GET /api/host/plugins` on each registered host to detect loaded plugins
- `GET /plugin-manifest` on each registered URL plugin
- Cached via ETag/If-None-Match
- New plugin → store definition, mark `AVAILABLE`
- Plugin gone → mark `UNAVAILABLE` after sustained failure (configurable: default 3 consecutive failures), then deactivate all configurations
- Version changed → trigger upgrade flow (section 10)
- Version conflict (same `pluginId` on different host with different version) → reject, log error, surface in admin UI

Host health: `GET /health` on each host (simple JSON response). Individual Wasm plugin health is implicit — if the host is up and the plugin is loaded, it's healthy. Failed Wasm calls are reported per-invocation.

### 9.3 External Plugin States

```
AVAILABLE → ACTIVE ⇄ DISABLED
                ↓
           UNAVAILABLE (plugin disappeared or host unreachable)
```

- **AVAILABLE**: Discovered, no configuration yet
- **ACTIVE**: Configured, permissions granted, operational
- **DISABLED**: Deactivated (manually or automatically)
- **UNAVAILABLE**: Plugin no longer reachable (host down, plugin removed)

### 9.4 Activation

Admin creates configuration + grants permissions + grants capabilities → ACTIVE:

- Service token issued to Plugin Host (hosted) or returned to plugin (URL)
- For hosted plugins: GZAC pushes decrypted configuration properties to the host's in-memory registry
- For stateless URL plugins: configuration is stored in GZAC only, sent with each call
- For push-based URL plugins: configuration is pushed to the plugin via `POST {pluginBaseUrl}/configurations`
- Granted endpoints active in allowlist filter
- Granted capabilities active in host function allowlist
- Event subscriptions registered — per-configuration RabbitMQ queue created and bound
- Frontend bundles/HTMX pages renderable
- Case tab entries created (backend `CaseTab` with `CUSTOM` type)
- Page definitions stored for menu registration

### 9.5 Deactivation (manual or automatic)

- Service token revoked
- Granted endpoints set `active = false` → filter rejects all external plugin requests
- Granted capabilities set `active = false` → host functions reject calls
- Event subscriptions paused (queue unbound, not deleted)
- Iframes show "plugin disabled" placeholder
- Process links fail with descriptive Operaton incident
- Case tab entries removed
- Menu items removed (dynamic menu re-evaluated on next page load)
- For push-based URL plugins: `DELETE {pluginBaseUrl}/configurations/{configId}`

**Auto-deactivation triggers:**

- GZAC upgraded beyond plugin's `maxGzacVersion`
- Host becomes unreachable for sustained period (configurable threshold, default 3 consecutive failures)
- Plugin removed from host
- Plugin upgrade makes configuration incompatible

## 10. Upgrade Flow

When a new external plugin version is detected:

1. Store new manifest alongside old, compare `configurationSchema.required` against each existing configuration
2. For each configuration:
   - Old config satisfies new required fields → config stays active, definition pointer updated
   - Does not satisfy → config auto-deactivated, admin notified
3. If permissions changed (new endpoints/events/capabilities added) → config auto-deactivated, admin must re-grant
4. Admin opens deactivated config → new config screen (iframe) → prefilled with old config via SDK `onPrefillConfiguration`
5. Admin completes missing fields, reviews permission changes, activates
6. Old manifest version deleted after all configs migrated or deactivated

## 11. Security

### 11.1 Wasm Sandbox (Plugin Host)

The Extism/Wasmtime sandbox is the primary security boundary for hosted plugins:

- Plugins execute in isolated linear memory with bounds checking
- No filesystem, network, or syscall access unless granted via host functions
- Host functions are the **only** way plugins interact with the outside world
- Each plugin gets its own Extism instance — plugins cannot see or affect each other
- Resource limits (memory, execution time) enforced by the runtime

Defense-in-depth: the Plugin Host itself runs in a Docker container with restricted capabilities (`no-new-privileges`, dropped capabilities, read-only root filesystem where possible).

### 11.2 External Plugin Service Token

Short-lived JWT (1 hour) for the Plugin Host calling GZAC on behalf of a hosted plugin, and for URL plugins calling GZAC directly. **Carries no roles.** Scoped to a single plugin configuration.

```json
{
  "sub": "external-plugin:risk-assessment:config-uuid",
  "type": "external_plugin_service",
  "plugin_config_id": "aaaaaaaa-...",
  "plugin_id": "risk-assessment",
  "iss": "valtimo-gzac",
  "exp": "<now + 1h>"
}
```

Each plugin configuration gets its own service token. If a plugin definition has 3 configurations, 3 separate tokens exist, each scoped to its own `plugin_config_id` and its own granted endpoints.

**Claim discriminator:** `type: "external_plugin_service"` distinguishes these from Keycloak tokens. The existing `TokenAuthenticationService` iterates `TokenAuthenticator` beans via `stream().filter(supports()).findFirst()`. A new `ExternalPluginServiceTokenAuthenticator` implements `TokenAuthenticator`:

- `supports(claims)` → checks `claims["type"] == "external_plugin_service"` (returns true before the Keycloak authenticator which checks for `email`)
- `authenticate()` → creates `Authentication` with `ExternalPluginServicePrincipal` (no `GrantedAuthority` roles)

**No roles granted.** Endpoint access controlled entirely by the allowlist filter (section 11.3). Prevents external plugins from bypassing PBAC or accessing any endpoint not explicitly granted.

**Key management:** Dedicated `ExternalPluginSecretKeyProvider` implements `SecretKeyProvider` with a separate HMAC-SHA256 signing secret (`valtimo.external-plugin.service-token-secret`). Independent from Keycloak RSA keys.

**Token lifecycle:**
- For hosted plugins: The Plugin Host manages token refresh (see section 6.9). The Wasm plugin never sees the raw token — the host injects it into outbound GZAC requests using the token mapped to the current call's `configurationId`.
- For URL plugins: The plugin is responsible for refreshing via `POST /api/v1/external-plugin/token/refresh` before expiry.

Revoked on deactivation (GZAC invalidates; host drops cached token).

### 11.3 Endpoint Allowlist Filter

A new `ExternalPluginEndpointAllowlistFilter` registered via `HttpSecurityConfigurer` (with `@Order` value below 500, placing it before `DenyAllHttpSecurityConfigurer`):

1. Detects `type: "external_plugin_service"` in JWT
2. Extracts `plugin_config_id`
3. Queries `external_plugin_granted_endpoint` where `configuration_id = plugin_config_id AND active = true`
4. Matches request method + path against granted patterns (Ant-style matching)
5. No match → 403
6. Match → sets up `SecurityContext` and continues filter chain

Each configuration has its own set of granted endpoints. Two configurations of the same plugin can have different endpoint grants.

Regular users and existing plugins are **unaffected**. Existing controllers require **zero changes**.

### 11.4 Capability Allowlist (Host Functions)

The Plugin Host enforces access control on host functions:

1. On each host function call, the host checks `external_plugin_granted_capability` for the current call's `configurationId` (cached in memory, refreshed on configuration change)
2. Capability not granted or `active = false` → host function returns error
3. Constraints are evaluated (e.g. `http-outbound` with `allowedUrls` pattern matching)
4. All host function calls are logged to the host's `external_plugin_api_log` table

This is defense-in-depth for hosted plugins: GZAC API calls pass through **both** the host (which injects the service token) and GZAC's endpoint allowlist. External HTTP calls pass through only the host capability check (GZAC is not involved). This dual-check is intentional.

### 11.5 Downscoped User Token

For iframe → GZAC user-facing endpoint calls:

1. GZAC frontend requests downscoped token: `POST /api/v1/external-plugin/{configId}/user-token`
2. Backend creates short-lived JWT carrying:
   - The user's identity (sub, email)
   - `plugin_config_id` claim
   - `type: "external_plugin_user"` claim
   - The user's actual roles (for PBAC evaluation)
   - Expiry: matches the parent Keycloak token's remaining lifetime
3. `ExternalPluginUserTokenAuthenticator` handles these:
   - `supports(claims)` → checks `type == "external_plugin_user"`
   - `authenticate()` → creates standard user `Authentication` with roles
4. Allowlist filter restricts to declared `userEndpoints` only
5. PBAC applies normally based on user's actual roles → intersection of PBAC + allowlist

Token forwarded to iframe via postMessage. When the parent Keycloak token refreshes, the frontend SDK requests a new downscoped token and delivers it to the iframe via `tokenRefresh` postMessage event.

### 11.6 Iframe Sandboxing

```html
<iframe
  sandbox="allow-scripts allow-same-origin allow-forms"
  [src]="trustedBundleUrl"
  referrerpolicy="no-referrer"
></iframe>
```

**Cross-origin requirement**: Plugin Host and URL plugins **must** run on a different origin than GZAC (different domain, subdomain, or port). The frontend validates this at runtime — if a plugin URL shares the same origin as GZAC, the iframe is not rendered and an error is shown. CSP `frame-src` includes only registered external plugin URLs.

The Plugin Host serves Content-Security-Policy headers on HTMX pages restricting script sources and form targets.

### 11.7 API Call Logging

All requests from external plugin service tokens logged to `external_plugin_api_log` (in the host's database), scoped by `plugin_config_id`. All host function calls logged. Truncated summaries, no secrets. Viewable in admin UI (GZAC admin UI queries host API). Configurable retention (default 30 days) with background cleanup in the Plugin Host.

### 11.8 Security Summary

| Layer | Hosted Plugins (Wasm) | URL Plugins |
|-------|----------------------|-------------|
| Backend code isolation | Wasm sandbox (memory, fs, network) | Process-level (separate service) |
| GZAC API access | Host function → service token (per-config) | Direct HTTP with service token (per-config) |
| GZAC API restriction | Endpoint allowlist per configuration | Endpoint allowlist per configuration |
| External HTTP access | Host function with URL allowlist | Unrestricted (their own process) |
| Frontend isolation | Iframe sandbox + CSP + cross-origin | Iframe sandbox + CSP + cross-origin |
| User-context API calls | Downscoped user token | Downscoped user token |
| Resource limits | Wasm memory + timeout | N/A (their own infra) |
| Configuration secrets | Decrypted by GZAC, held in host memory only | Sent per-call (inline) or pushed on activation |

## 12. Event System (RabbitMQ)

### 12.1 Architecture: Routing Key Addition + New Topic Exchange

The existing `valtimo-events` exchange is `fanout` (no routing key filtering). To enable per-plugin event filtering:

**Step 1: Set routing key on outbox messages.** Modify `RabbitMessagePublisher` to set the routing key to the CloudEvent `type` string when publishing. Fanout exchanges ignore routing keys, so this change is **fully backwards-compatible** — all existing consumers continue receiving all messages.

**Step 2: Add a new topic exchange.** Create `valtimo-external-plugin-events` (type: `topic`, durable). Create an exchange-to-exchange binding from `valtimo-events` (fanout) to `valtimo-external-plugin-events` (topic) with routing key `#`. This means all messages published to the fanout exchange are also delivered to the topic exchange, preserving their routing keys.

**Step 3: Per-configuration queues.** Each plugin **configuration** (not definition) gets its own queue, bound to the topic exchange with routing keys matching its granted event types. This means two configurations of the same plugin that subscribe to the same event each get their own copy of the event, delivered to separate queues.

This approach requires:
- One small change to `RabbitMessagePublisher` (set routing key from CloudEvent type)
- No changes to existing consumers, exchanges, or queue bindings
- No changes to `OutboxService`, `CloudEventFactory`, or `PollingPublisherService`

### 12.2 Event Delivery Per Hosting Mode

**URL Plugins**: Consume directly from their dedicated RabbitMQ queue. Credentials delivered during activation (see 12.5).

**Hosted Plugins (Wasm)**: The Plugin Host consumes from each configuration's RabbitMQ queue using `amqplib`. On message receipt, it looks up the `configurationId` from the queue name, retrieves the corresponding decrypted configuration from its registry, and calls the Wasm module's `handle_event` function with both the event data and the configuration context. The Wasm module does not need its own RabbitMQ connection.

### 12.3 Flow

1. Manifest declares desired events in `permissions.events`
2. Admin grants event access during configuration activation
3. On activation, GZAC:
   - Creates dedicated RabbitMQ queue: `external-plugin.{configId}` (quorum queue)
   - Creates bindings to `valtimo-external-plugin-events` exchange for each granted event routing key
   - For URL plugins: creates dedicated RabbitMQ user with read permission on its queue only
   - For hosted plugins: Plugin Host consumes from the queue using its own credentials
4. Events are delivered to the plugin with configuration context

### 12.4 RabbitMQ User Management

Uses the RabbitMQ Management HTTP API (for URL plugin credentials only):

```yaml
valtimo:
  external-plugin:
    rabbitmq:
      management-url: http://rabbitmq:15672
      admin-username: ${RABBITMQ_ADMIN_USERNAME}
      admin-password: ${RABBITMQ_ADMIN_PASSWORD}
```

### 12.5 Credentials Delivery (URL Plugins only)

Returned in activation response alongside service token:

```json
{
  "serviceToken": "eyJ...",
  "rabbitmq": {
    "host": "rabbitmq.internal",
    "port": 5672,
    "username": "ext-plugin-config-uuid",
    "password": "generated-password",
    "queue": "external-plugin.config-uuid",
    "virtualHost": "/"
  }
}
```

For stateless URL plugins, the event payload includes the configuration so the plugin knows which credentials to use:

```json
{
  "type": "DocumentCreated",
  "data": { "documentId": "..." },
  "configurationId": "config-uuid-A",
  "configuration": { "apiKey": "key1", "baseUrl": "https://..." }
}
```

For push-based URL plugins (`"configurationDelivery": "push"`), the event payload includes only `configurationId`.

Hosted plugins do not receive RabbitMQ credentials — the host handles event delivery and configuration injection.

### 12.6 SDK Event Handler

```typescript
import { onEvent, config, log } from "@valtimo/external-plugin-sdk";

// config.getAll() returns the configuration for this specific invocation
onEvent("DocumentCreated", async (event) => {
  const cfg = await config.getAll();
  log.info(`Document created: ${event.data.documentId}, using API at ${cfg.baseUrl}`);
});
```

### 12.7 Lifecycle

- **Deactivation** → queue unbound, RabbitMQ user credentials revoked (URL plugins)
- **Reactivation** → queue rebound, new credentials issued (URL plugins)
- **Removal** → queue deleted, RabbitMQ user removed (URL plugins)

## 13. Frontend Integration

### 13.1 `@valtimo/external-plugin` (new Angular library)

Under `projects/valtimo/external-plugin/`, following the project's coding guidelines (`frontend/CODING-GUIDELINES.md`):

```
lib/
├── components/
│   ├── external-plugin-iframe/
│   │   ├── external-plugin-iframe.component.ts      # Standalone, OnPush
│   │   └── external-plugin-iframe.component.html
│   ├── external-plugin-management/
│   │   ├── external-plugin-management.component.ts
│   │   └── ...
│   ├── external-plugin-case-tab/
│   │   ├── external-plugin-case-tab.component.ts
│   │   └── ...
│   ├── external-plugin-case-widget/
│   │   ├── external-plugin-case-widget.component.ts
│   │   └── ...
│   └── external-plugin-page/
│       ├── external-plugin-page.component.ts
│       └── ...
├── services/
│   ├── external-plugin-management.service.ts
│   ├── external-plugin-menu.service.ts
│   └── index.ts
├── models/
│   ├── external-plugin.model.ts
│   └── index.ts
├── constants/
│   ├── external-plugin.test-ids.ts
│   └── index.ts
└── index.ts
```

New components use `standalone: true`, `ChangeDetectionStrategy.OnPush`, Angular signals for local state, and `data-test-id` attributes from test ID constants — as required by the coding guidelines.

### 13.2 Integration Points

| Feature | Type in frontendBundles | Context passed to iframe | Render Modes |
|---------|------------------------|---------|--------------|
| Plugin config | `config` | Existing config (prefill), pluginDefinitionKey, pluginConfigurationId | `bundle` |
| Case tab | `case-tab` | documentId, caseDefinitionKey, pluginConfigurationId, zaakUrl, zaaktype | `bundle`, `htmx` |
| Case widget | `case-widget` | Same + widgetKey | `bundle`, `htmx` |
| Page | `page` | pluginId, pageKey, pluginConfigurationId | `bundle`, `htmx` |
| Process link config | `process-link-action` | processDefinitionId, activityId, activityType, existing config | `bundle` |

Every iframe context includes `pluginConfigurationId` so the iframe (and the plugin host, for hosted plugins) knows which configuration applies.

### 13.3 Case Tab Integration

Leverages existing `CaseTabType.CUSTOM` + `CASE_TAB_TOKEN`.

**Backend**: External plugin activation creates `CaseTab` entries with `type = CUSTOM` and `contentKey = "external-plugin:{pluginId}:{tabKey}"`.

**Frontend**: The existing `CaseTabService` uses exact property lookup on `caseTabConfig[tab.contentKey]`. Since external plugin tab keys are dynamic (unknown at compile time), the lookup logic is extended:

- Modify `CaseTabService` to add a prefix-matching fallback: if exact `caseTabConfig[contentKey]` lookup returns nothing, check if any registered prefix handler matches. A prefix handler is registered as `{ prefix: "external-plugin:", component: ExternalPluginCaseTabComponent }`.
- This is a small, targeted change to `CaseTabService`: after the exact match check, add a prefix scan over registered prefix handlers.
- `ExternalPluginCaseTabComponent` is registered as the prefix handler for `"external-plugin:"` in the `CASE_TAB_TOKEN` configuration.
- The component extracts `pluginId` and `tabKey` from the `contentKey` string and renders `ExternalPluginIframeComponent`.

### 13.4 Case Widget Integration

Leverages existing `CUSTOM` widget discriminator + `CUSTOM_WIDGET_TOKEN`.

**Backend**: New `ExternalPluginCaseWidget` entity with `@DiscriminatorValue("external-plugin")`. `ExternalPluginCaseWidgetMapper` implements `CaseWidgetMapper`. **Widget data is fetched client-side**: the `ExternalPluginCaseWidgetDataProvider` returns only the plugin metadata (plugin ID, widget key, host URL, configuration ID), and the iframe fetches actual data directly from the plugin host or URL plugin. This avoids a circular dependency (GZAC calling host, host calling back to GZAC) and keeps the server-side widget data call fast.

**Frontend**: Same prefix-matching approach as case tabs. `ExternalPluginCaseWidgetComponent` registered under `CUSTOM_WIDGET_TOKEN` with prefix handler for `"external-plugin:"`. Renders `ExternalPluginIframeComponent`.

### 13.5 Page Integration

- Backend: External plugin activation stores page definitions in the `external_plugin_page` table.
- Frontend: `ExternalPluginMenuService` registers via `MenuService.registerAppendMenuItemsFunction()` — following the same pattern as `CaseMenuService` and `ObjectMenuService`. The function queries GZAC for active external plugin pages (`GET /api/v1/external-plugin/page`) and appends menu items at the positions specified by `menuPosition`.
- Routes to generic `ExternalPluginPageComponent` rendering `ExternalPluginIframeComponent`.
- Menu position (`"after:cases"`) resolved against current menu item titles. Falls back to end of menu if anchor not found.
- The page URL includes `configurationId` as a parameter so the correct configuration context is used.

### 13.6 HTMX Page Rendering

For `renderMode: "htmx"`:

1. `ExternalPluginIframeComponent` sets iframe `src` to the plugin's HTMX page URL on the host (e.g. `{hostBaseUrl}/plugins/{pluginId}/pages/settings?configId={configId}`)
2. Host serves initial HTML page (static from package or dynamic from Wasm `render_page`), injecting the configuration context into the Wasm call
3. Page includes HTMX library (from host's `/shared/htmx.min.js`) and `external-plugin-htmx-bridge.js`
4. Subsequent HTMX interactions (`hx-get`, `hx-post`) are routed to the host, which calls `render_page` in the Wasm module with the configuration context and returns HTML partials
5. Authentication: Bridge script receives access token via postMessage `init` event, injects into HTMX requests via `htmx:configRequest`
6. Communication with Angular parent: Same postMessage protocol as JS bundles

### 13.7 Process Link Integration

New `ExternalPluginProcessLink` follows the existing extension pattern with discriminator `"external_plugin"` on the `process_link` table:

**Backend:**

- Entity: `ExternalPluginProcessLink` with `@DiscriminatorValue("external_plugin")` extending `ProcessLink`. Uses the new columns `external_plugin_config_id`, `external_plugin_action_key`, `external_plugin_action_properties` on the `process_link` table. The `external_plugin_config_id` points to a specific configuration — this is how the runtime knows which configuration to use when the process link fires.
- `ExternalPluginProcessLinkMapper` implementing `ProcessLinkMapper`:
  - `supportsProcessLinkType("external_plugin")`
  - `toProcessLinkResponseDto()` / `toNewProcessLink()` / `toUpdatedProcessLink()`
  - `createRelatedExportRequests()` — exports the external plugin definition reference
  - `afterImport()` — validates that the referenced external plugin definition exists and is active; publishes `CaseConfigurationIssueDetectedEvent` if not found
- `ExternalPluginProcessLinkActivityHandler` implementing `ProcessLinkActivityHandler`
- `ExternalPluginSupportedProcessLinkTypeHandler` implementing `SupportedProcessLinkTypeHandler`

**Frontend:** Process link modal extended with a new step for discovering external plugins, selecting a configuration, and configuring the action.

## 14. Process Link Actions

1. Process reaches linked activity → Operaton listener fires → `ProcessLinkActivityService` finds `ExternalPluginProcessLink`
2. `ExternalPluginProcessLinkActivityHandler` fires
3. Read `external_plugin_config_id` from the process link to determine which configuration to use
4. Resolve action properties via `ValueResolverService` (`doc:`, `pv:`, etc.) — same mechanism as existing plugins
5. GZAC calls `POST {hostBaseUrl}/plugins/{pluginId}/actions/{actionKey}` with the configuration's service token (for hosted plugins) or `POST {pluginBaseUrl}/actions/{actionKey}` (for URL plugins)
6. For hosted plugins: Host looks up configuration by `configurationId`, injects decrypted properties into Wasm call
7. For URL plugins: Request body includes full configuration (inline mode) or just `configurationId` (push mode)
8. Body: `{ "configurationId": "...", "configuration": {...}, "processInstanceId": "...", "documentId": "...", "activityId": "...", "properties": {...} }`
9. Response: `{ "status": "completed", "variables": {...} }`
10. Variables written to process via Operaton API

**Error handling:**

- Configurable timeout (default 30s) and retry (count + exponential backoff)
- 4xx → `BpmnError` (catchable in process)
- 5xx / timeout exhausted → Operaton incident
- Wasm execution timeout → Operaton incident with "plugin execution timeout" message

## 15. Compatibility

- On GZAC upgrade: check all active external plugin definitions against the version from `GET /api/v1/version`
- Plugin has `maxGzacVersion` and GZAC exceeds it → auto-deactivate all configurations, notify admin
- Plugin has no `maxGzacVersion` → stays active
- Plugin upgrade with incompatible config schema → deactivate config, prefill on reconfiguration

## 16. Monorepo Structure

```
valtimo/
├── backend/
│   ├── plugin/                            # UNCHANGED
│   ├── external-plugin/                   # NEW (GZAC backend module)
│   │   ├── src/main/kotlin/com/ritense/externalplugin/
│   │   │   ├── domain/
│   │   │   ├── repository/
│   │   │   ├── service/
│   │   │   ├── security/
│   │   │   ├── web/rest/
│   │   │   ├── event/
│   │   │   ├── processlink/
│   │   │   ├── casetab/
│   │   │   ├── casewidget/
│   │   │   └── autoconfigure/
│   │   └── src/main/resources/config/liquibase/
│   └── ...
│
├── frontend/projects/valtimo/
│   ├── plugin/                            # UNCHANGED
│   ├── external-plugin/                   # NEW (Angular library)
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── components/
│   │   │   │   │   ├── external-plugin-iframe/
│   │   │   │   │   ├── external-plugin-management/
│   │   │   │   │   ├── external-plugin-case-tab/
│   │   │   │   │   ├── external-plugin-case-widget/
│   │   │   │   │   └── external-plugin-page/
│   │   │   │   ├── services/
│   │   │   │   ├── models/
│   │   │   │   └── constants/
│   │   │   └── index.ts
│   │   ├── src/public-api.ts
│   │   └── ...
│   └── ...
│
├── plugin-host/                           # NEW (Node.js application)
│   ├── src/
│   │   ├── index.ts                       # Entry point, Fastify setup
│   │   ├── plugin-manager.ts              # Manages Wasm plugin lifecycle
│   │   ├── config-registry.ts             # In-memory configId → {properties, token} map
│   │   ├── host-functions/
│   │   │   ├── http-request.ts
│   │   │   ├── gzac-api.ts
│   │   │   ├── log.ts
│   │   │   ├── config.ts
│   │   │   └── kv-store.ts
│   │   ├── routes/
│   │   │   ├── host-management.ts         # /api/host/plugins
│   │   │   ├── host-configurations.ts     # /api/host/configurations (push from GZAC)
│   │   │   ├── plugin-actions.ts          # /plugins/:id/actions/:key
│   │   │   ├── plugin-api.ts             # /plugins/:id/api/*
│   │   │   ├── plugin-pages.ts           # /plugins/:id/pages/*
│   │   │   └── plugin-bundles.ts         # /plugins/:id/bundles/*
│   │   ├── events/
│   │   │   └── event-consumer.ts          # RabbitMQ → Wasm delivery (per-config queue)
│   │   ├── security/
│   │   │   ├── hmac-auth.ts               # HMAC authentication for management API
│   │   │   ├── token-validator.ts         # Service token validation for plugin calls
│   │   │   └── capability-guard.ts        # Host function access control
│   │   ├── token/
│   │   │   └── token-manager.ts           # Per-config service token lifecycle & refresh
│   │   ├── db/
│   │   │   ├── migrations/                # Host database migrations
│   │   │   ├── kv-store.ts
│   │   │   └── api-log.ts
│   │   └── config.ts                      # Environment configuration
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── sdks/
│   ├── external-plugin-sdk/               # Backend JS/TS plugin SDK
│   │   ├── src/
│   │   │   ├── index.ts                   # SDK entry point & exports
│   │   │   ├── actions.ts                 # action() handler registration
│   │   │   ├── events.ts                  # onEvent() handler registration
│   │   │   ├── requests.ts                # onRequest() handler registration
│   │   │   ├── pages.ts                   # renderPage() handler registration
│   │   │   ├── host-functions.ts          # gzacApi, http, kv, log wrappers
│   │   │   ├── config.ts                  # config.getAll() reads from call input context
│   │   │   └── types.ts                   # TypeScript interfaces
│   │   ├── bin/
│   │   │   ├── valtimo-plugin-build.ts    # Wraps extism-js compiler
│   │   │   └── valtimo-plugin-pack.ts     # Assembles .zip package
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── external-plugin-frontend-sdk/      # Frontend iframe SDK
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── postmessage.ts
│   │   │   └── htmx-bridge.ts
│   │   └── package.json
│   │
│   └── create-external-plugin/            # Project scaffolding CLI
│       ├── src/
│       │   └── index.ts
│       ├── templates/
│       │   ├── manifest.json.hbs
│       │   ├── plugin.ts.hbs
│       │   └── package.json.hbs
│       └── package.json
│
└── ...
```

## 17. REST Endpoints

### Management API — GZAC (`/api/management/v1/external-plugin/`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/host` | List registered hosts |
| POST | `/host` | Register new host (also used by host self-registration) |
| PUT | `/host/{hostId}` | Update host |
| DELETE | `/host/{hostId}` | Remove host |
| GET | `/definition` | List external plugin definitions |
| GET | `/definition/{pluginId}` | Get definition details |
| POST | `/url-plugin` | Register URL plugin |
| DELETE | `/url-plugin/{pluginId}` | Remove URL plugin |
| GET | `/configuration` | List configurations (optionally filtered by definition) |
| POST | `/configuration` | Create configuration (activate) |
| PUT | `/configuration/{configId}` | Update configuration |
| DELETE | `/configuration/{configId}` | Delete configuration |
| POST | `/configuration/{configId}/activate` | Activate |
| POST | `/configuration/{configId}/deactivate` | Deactivate |
| GET | `/configuration/{configId}/capabilities` | View granted capabilities |
| PUT | `/configuration/{configId}/capabilities` | Update granted capabilities |

### Runtime API — GZAC (`/api/v1/external-plugin/`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/version` | GZAC version (for compatibility checks) |
| POST | `/token/refresh` | Refresh service token (HMAC-authenticated) |
| POST | `/{configId}/user-token` | Get downscoped user token for iframe |
| GET | `/page` | List available pages (for menu) |

### Plugin Host API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/host/plugins` | HMAC | List loaded plugins with manifests |
| POST | `/api/host/plugins` | HMAC | Upload plugin package (hot-reload) |
| DELETE | `/api/host/plugins/{pluginId}` | HMAC | Unload and remove plugin |
| GET | `/api/host/plugins/{pluginId}/status` | HMAC | Plugin runtime status (memory, calls) |
| GET | `/api/host/plugins/{pluginId}/log` | HMAC | Query API call logs |
| POST | `/api/host/configurations/{configId}` | HMAC | Push configuration from GZAC |
| PUT | `/api/host/configurations/{configId}` | HMAC | Update configuration from GZAC |
| DELETE | `/api/host/configurations/{configId}` | HMAC | Remove configuration |
| GET | `/health` | None | Host health check |
| GET | `/plugins/{pluginId}/plugin-manifest` | None | Plugin manifest |
| GET | `/plugins/{pluginId}/bundles/**` | None | Frontend bundles (public, served to iframes) |
| GET | `/plugins/{pluginId}/pages/**` | Token | HTMX pages (configId in query param) |
| POST | `/plugins/{pluginId}/actions/{actionKey}` | Token | Execute action (configId in body) |
| * | `/plugins/{pluginId}/api/**` | Token | Generic plugin API (configId in header) |

### URL Plugin Contract Endpoints (implemented by URL plugins)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/plugin-manifest` | Return plugin manifest |
| POST | `/actions/{actionKey}` | Execute action (body includes configurationId + configuration) |
| POST | `/configurations` | Receive configuration push (push-based only) |
| PUT | `/configurations/{configId}` | Update pushed configuration (push-based only) |
| DELETE | `/configurations/{configId}` | Remove pushed configuration (push-based only) |

## 18. Deployment

### Docker Compose Example

```yaml
services:
  gzac:
    image: ritense/gzac:latest
    ports:
      - "8080:8080"
    environment:
      VALTIMO_EXTERNAL_PLUGIN_SERVICE_TOKEN_SECRET: ${SERVICE_TOKEN_SECRET}

  plugin-host:
    image: ritense/gzac-plugin-host:latest
    ports:
      - "8090:8090"
    volumes:
      - plugin-storage:/plugins
    environment:
      GZAC_BASE_URL: http://gzac:8080
      RABBITMQ_URL: amqp://rabbitmq:5672
      SERVICE_TOKEN_SECRET: ${SERVICE_TOKEN_SECRET}
      DATABASE_URL: postgresql://plugin-host-db:5432/plugin_host
      LOG_LEVEL: info
    deploy:
      resources:
        limits:
          memory: 1G
    security_opt:
      - no-new-privileges:true

  plugin-host-db:
    image: postgres:16
    environment:
      POSTGRES_DB: plugin_host
      POSTGRES_USER: plugin_host
      POSTGRES_PASSWORD: ${PLUGIN_HOST_DB_PASSWORD}
    volumes:
      - plugin-host-db-data:/var/lib/postgresql/data

  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"
      - "15672:15672"

  keycloak:
    image: quay.io/keycloak/keycloak:latest
    ports:
      - "8081:8080"

volumes:
  plugin-storage:
  plugin-host-db-data:
```

The Plugin Host runs as a sidecar to GZAC. It does not share a process with GZAC. This provides defense-in-depth: even if a Wasm sandbox escape occurs, the attacker is in the Plugin Host container, not in GZAC.

### Plugin Host Docker Image

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
EXPOSE 8090
CMD ["node", "dist/index.js"]
```

The Docker image includes the native Extism runtime (`libextism.so`) bundled via the `@extism/extism` NPM package. Operators don't need to manage native dependencies.

### Plugin Host Tech Stack

| Concern | Library |
|---------|---------|
| HTTP server | Fastify |
| Wasm runtime | `@extism/extism` |
| RabbitMQ client | amqplib |
| Database | PostgreSQL via `postgres` (porsager/postgres) |
| DB migrations | `postgres-migrations` or `node-pg-migrate` |
| Logging | pino |
| Validation | zod |
| File uploads | `@fastify/multipart` |
| Static files | `@fastify/static` |
| Configuration | dotenv + zod schema |

## 19. Plugin Developer Experience

A complete example of building and deploying a hosted plugin:

**1. Scaffold**

```bash
npx @valtimo/create-external-plugin risk-assessment
cd risk-assessment
npm install
```

Generates project with `manifest.json`, `src/plugin.ts`, `frontend/`, `package.json`.

**2. Write backend logic** (`src/plugin.ts`)

```typescript
import { action, onEvent, gzacApi, http, config, log } from "@valtimo/external-plugin-sdk";

// The plugin is stateless — config is injected per call.
// If two configurations exist, this code runs twice with different configs.
action("calculate-risk", async (input) => {
  const cfg = await config.getAll(); // reads from injected context, zero overhead
  const doc = await gzacApi.get(`/api/v1/document/${input.documentId}`);
  const score = await http.post(cfg.baseUrl + "/score", {
    amount: doc.content.loanAmount,
    applicant: doc.content.applicantId,
  });
  log.info(`Risk score for ${input.documentId}: ${score.value}`);
  return { status: "completed", variables: { riskScore: score.value } };
});

onEvent("DocumentCreated", async (event) => {
  log.info(`New document: ${event.data.documentId}`);
});
```

**3. Write frontend** (`frontend/config.js`, `frontend/risk-overview.js`, etc.)

Standard JS/TS, using `@valtimo/external-plugin-frontend-sdk` for iframe communication.

**4. Build**

```bash
npm run build   # Compiles TS → JS → plugin.wasm
npm run pack    # Produces risk-assessment-1.2.0.zip
```

**5. Deploy**

```bash
curl -X POST http://plugin-host:8090/api/host/plugins \
  -H "X-HMAC-Signature: $(echo -n '...' | openssl dgst -sha256 -hmac $SECRET)" \
  -F "file=@risk-assessment-1.2.0.zip"
```

**6. Configure in GZAC admin UI**

- GZAC discovers the plugin via host polling
- Admin creates one or more configurations, each with its own API keys and settings
- Admin grants permissions and capabilities per configuration
- Each configuration becomes independently active

## 20. Cleanup on Removal

When a plugin is fully removed (not just deactivated):

1. All configurations' service tokens revoked
2. All configurations deleted
3. Granted endpoints and capabilities deleted
4. Event subscriptions deleted, per-configuration RabbitMQ queues deleted, RabbitMQ users removed (URL plugins)
5. `CaseTab` entries with matching `contentKey` prefix deleted
6. `external_plugin_page` entries deleted (menu items removed dynamically on next page load)
7. Plugin definition deleted
8. **Active process instances** with `ExternalPluginProcessLink` references are **not** altered — they will produce Operaton incidents on next execution (by design; admin should resolve process instances before removal)
9. KV store data for all plugin configurations deleted from host database
10. API log entries retained for configurable period (default 30 days), then purged
11. For push-based URL plugins: `DELETE {pluginBaseUrl}/configurations/{configId}` for each configuration

## 21. Open Questions

1. **Multi-tenancy:** Should external plugins be tenant-scoped? Recommendation: definitions global, configurations per-tenant.

2. **Webhooks vs RabbitMQ:** Some URL plugins may prefer HTTP webhooks for event delivery. Support both — optional `"eventDelivery": "webhook"` in manifest. GZAC POSTs CloudEvents to `{pluginBaseUrl}/events` with retry, including configuration context per the delivery mode. RabbitMQ remains default.

3. **Plugin-to-plugin communication:** Out of scope for v1.

4. **SDK publishing pipeline:** Backend SDK, Frontend SDK, and create-external-plugin CLI to NPM.

5. **Plugin marketplace/registry:** Out of scope for v1.

6. **HTMX shared layout:** Should the Plugin Host provide shared CSS/layout resources (GZAC design system) to plugin HTMX pages? Recommended for visual consistency.

7. **Existing plugin migration path:** Tooling to convert build-time plugins to external plugins — out of scope for v1.

8. **Extism Chicory SDK:** A pure-Java Wasm runtime exists (Chicory, with an Extism SDK at `extism/chicory-sdk`). If embedding in GZAC itself is ever needed (eliminating the Node.js sidecar), the Chicory SDK provides this path. Does not change the plugin developer experience. Monitor for maturity.

9. **Additional language SDKs:** Rust, Go, and other language SDKs can be added later. The Wasm module contract (section 6.6) and host functions (section 6.7) are language-agnostic — only the SDK layer changes.

10. **Wasm Component Model:** The WebAssembly Component Model (part of WASI Preview 2, which is now stable) standardizes richer interfaces than bytes-in/bytes-out. Adopt when Extism supports it, enabling typed function signatures and eliminating JSON serialization overhead.

11. **Configuration-scoped pages:** Currently pages are per-definition, not per-configuration. If a plugin has two configurations, they share the same page menu items. Should pages be per-configuration (two menu items, one per config)? Recommendation: per-definition with configuration selector within the page.
