# External Plugin System — Complete Plan (v12)
**Changes from v11:**
1. **Multi-GZAC support**: The Plugin Host no longer has a single GZAC_BASE_URL. Multiple GZAC instances register themselves with the host, each providing their own secret. The host tracks which configurations belong to which GZAC instance and routes callbacks (token refresh, gzac_api calls) accordingly.
2. **Multi-version plugins**: A single host can load multiple versions of the same plugin simultaneously. Different GZAC instances (or configurations within the same GZAC) can target different versions. The `pluginId + version` pair is the unique identifier on the host, not `pluginId` alone.
## 1. Terminology
| Term | Meaning |
|------|---------|
| Plugin (existing) | Current build-time plugins (Java annotations, Angular components). Unchanged. All existing names, paths, tables, annotations stay as-is. |
| External Plugin | New external plugins. Backend logic runs as a sandboxed JavaScript/TypeScript Wasm module in the Plugin Host, or as a standalone URL Plugin. |
| External Plugin Host | Node.js service embedding the Extism WebAssembly runtime. Loads `.wasm` plugin modules with true sandbox isolation. Serves one or more GZAC instances. |
| URL Plugin | Standalone service at a URL conforming to the external plugin contract. Any tech stack. No sandbox — trust is established out-of-band. |
| External Plugin Configuration | An instance of a configured external plugin (credentials, settings). Multiple allowed per external plugin definition. Each configuration carries its own credentials, permissions, and event subscriptions. Owned by a specific GZAC instance. |
| GZAC Instance | A single GZAC application that has registered itself with the Plugin Host. Identified by a unique `gzacInstanceId`. Each instance has its own secret, configurations, and service tokens. |
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
| Multi-version | Multiple versions coexist on same host | Each URL is a single version |
Multiple versions of the same plugin can coexist on a single host. Each GZAC instance's configurations target a specific `pluginId@version`.
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
2. The host stores `configId → { properties, gzacInstanceId, pluginId, pluginVersion }` in memory
3. On each call (action, event, request, page render), the host injects the configuration into the Wasm function input and routes to the correct Wasm module version
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
   Example: "risk-assessment" has Config A (GZAC-1) and Config B (GZAC-2), both subscribing to `DocumentCreated`.
```
DocumentCreated event published by GZAC-1
  → routed to queue "external-plugin.{config-A-id}"
DocumentCreated event published by GZAC-2
  → routed to queue "external-plugin.{config-B-id}"
Host consumes from both queues:
  → calls handle_event on risk-assessment@1.2.0 with config A's credentials/settings
  → calls handle_event on risk-assessment@1.2.0 with config B's credentials/settings
```
Each invocation is independent. The same `.wasm` module is called twice with different configuration payloads. If the two configurations target different plugin versions, different Wasm modules are invoked.
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
- For hosted plugins, GZAC accesses the manifest via `GET {hostBaseUrl}/plugins/{pluginId}/{version}/plugin-manifest` (the host returns the stored manifest from the plugin package). For URL plugins, GZAC accesses `GET {pluginBaseUrl}/plugin-manifest` directly.
## 6. External Plugin Host
Lives in `plugin-host/app/` in the monorepo. Node.js + TypeScript + Fastify + Extism. Published as Docker image.
### 6.1 Architecture
The Plugin Host is a Node.js application that embeds the Extism WebAssembly runtime. It:
- Loads `.wasm` plugin modules into isolated Extism sandboxes — multiple versions of the same plugin can coexist
- Exposes an HTTP API that multiple GZAC instances and frontends call
- Translates HTTP requests into Wasm function calls (JSON in, JSON out), routing to the correct plugin version
- Provides host functions that plugins can call for controlled access to external resources
- Serves frontend bundles and HTMX pages from plugin packages (version-scoped)
- Consumes RabbitMQ events and delivers them to Wasm plugins
- Manages its own database for plugin key-value storage and API call logs
- Maintains a per-configuration map of decrypted properties, service tokens, and GZAC instance references, injecting them into every Wasm call
- Tracks registered GZAC instances with their secrets and base URLs
```
┌──────────────────────────────────────────────────────────────┐
│  Plugin Host (Node.js + Extism)                              │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Plugin A v1   │  │ Plugin A v2   │  │ Plugin B v1   │       │
│  │ (Wasm)       │  │ (Wasm)       │  │ (Wasm)       │       │
│  │ isolated      │  │ isolated      │  │ isolated      │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │                │
│  ┌──────┴─────────────────┴─────────────────┴──────┐        │
│  │           Host Functions (bridge)                │        │
│  │  http_request · log · config · kv_store · gzac_api│       │
│  └─────────────────────────────────────────────────┘        │
│                                                              │
│  ┌─────────────────────────────────────────────────┐        │
│  │       GZAC Instance Registry                     │        │
│  │  gzacInstanceId → { baseUrl, secret }            │        │
│  │  Populated on registration                       │        │
│  └─────────────────────────────────────────────────┘        │
│                                                              │
│  ┌─────────────────────────────────────────────────┐        │
│  │       Configuration Registry                     │        │
│  │  configId → { properties, serviceToken,          │        │
│  │              gzacInstanceId, pluginId, version }  │        │
│  │  In-memory, pushed from each GZAC instance       │        │
│  └─────────────────────────────────────────────────┘        │
│                                                              │
│  ┌─────────────────────────────────────────────────┐        │
│  │           HTTP Layer (Fastify)                   │        │
│  │  GZAC registration · Management API              │        │
│  │  Plugin routing (version-aware) · Bundle serving  │        │
│  └─────────────────────────────────────────────────┘        │
│                                                              │
│  ┌─────────────────────────────────────────────────┐        │
│  │      RabbitMQ Consumer (amqplib)                 │        │
│  │  Per-config queue → handle_event() call          │        │
│  │  Routes to correct plugin version                │        │
│  └─────────────────────────────────────────────────┘        │
│                                                              │
│  ┌─────────────────────────────────────────────────┐        │
│  │      Host Database (PostgreSQL)                  │        │
│  │  KV store · API call logs · GZAC registrations   │        │
│  └─────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────┘
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
Plugin upload/removal requires authentication. The host accepts an `X-Admin-Token` header validated against the `ADMIN_TOKEN` environment variable (a static bearer token configured by the operator). This is independent of GZAC instance secrets — it's for operators managing the host directly.
- `GET /api/host/plugins` — list loaded plugins with manifests (includes version info)
- `POST /api/host/plugins` — upload plugin package (`.zip` containing `.wasm` + frontend assets). Extracts `pluginId` and `version` from manifest. If same `pluginId@version` already loaded, hot-reloads. Different version of same plugin loads alongside existing versions.
- `DELETE /api/host/plugins/{pluginId}/{version}` — unload and remove specific version. Fails if any active configurations reference this version.
- `GET /api/host/plugins/{pluginId}` — list all loaded versions of a plugin
### 6.4 Per Plugin (delegated by host)
All plugin routes are version-scoped:
- `GET /plugins/{pluginId}/{version}/plugin-manifest` — returns manifest (stored alongside wasm)
- `GET /plugins/{pluginId}/{version}/bundles/**` — frontend bundles (static files from package, public)
- `GET /plugins/{pluginId}/{version}/pages/**` — HTMX pages (calls Wasm function `render_page` with page key and context, returns HTML; public, served in iframe)
- `POST /plugins/{pluginId}/{version}/actions/{actionKey}` — calls Wasm function with action key and JSON payload (requires valid GZAC service token)
- `* /plugins/{pluginId}/{version}/api/**` — generic plugin API (calls Wasm function `handle_request` with method, path, headers, body; requires valid token)
  All action/API calls include a `configurationId` header or body field. The host looks up the configuration from its in-memory registry, verifies the configuration targets the requested plugin version, and injects the decrypted properties into the Wasm function input.
### 6.5 Plugin Package Structure
```
risk-assessment-1.2.0.zip
├── manifest.json              # Plugin manifest (must include pluginId + version)
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
Uses the plugin configuration's service token (managed by the host, never exposed to the Wasm module). **The host routes the request to the correct GZAC instance** by looking up `gzacInstanceId` from the configuration registry and using that instance's `baseUrl`. Restricted to endpoints granted in `external_plugin_granted_endpoint` — enforced by GZAC's endpoint allowlist filter.
**`log(json)`** — Write to host logging (always available, no capability required)
```
Input:  { "level": "info", "message": "Processing document xyz" }
```
Logs are written to the host's structured logger (pino) with plugin ID, version, and configuration ID prefix.
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
### 6.9 GZAC-Host Authentication
**GZAC registers itself with the host.** The host does not initiate contact with GZAC — it is a passive service that multiple GZAC instances connect to.
**GZAC registration flow:**
1. GZAC calls `POST /api/host/gzac-instances` on the host, providing:
   ```json
   {
     "gzacInstanceId": "gzac-prod-1",
     "baseUrl": "http://gzac:8080",
     "secret": "per-instance-hmac-secret",
     "version": "13.1.3"
   }
   ```
   This request is authenticated with the host's `ADMIN_TOKEN` (same token used for plugin management). The `secret` field is the HMAC-SHA256 secret that this GZAC instance will use to sign subsequent requests and that the host will use to sign service tokens for this instance's configurations.
2. The host stores the GZAC instance in its registry: `gzacInstanceId → { baseUrl, secret, version }`. This is persisted to the host database so it survives restarts.
3. The host returns a list of loaded plugins (with versions) so GZAC can evaluate compatibility and discover available plugins.
4. GZAC can re-register at any time (e.g. after restart, after URL change). The host updates the stored record.
   **Subsequent GZAC → Host requests** (configuration push, action calls, etc.) include:
- `X-GZAC-Instance-Id` header identifying which GZAC instance is calling
- `X-HMAC-Signature` header: HMAC-SHA256 signature over the request body using that instance's secret
  The host validates: look up the instance by `gzacInstanceId`, verify the HMAC signature using the stored secret.
  **Configuration push (activation):**
  When a GZAC admin activates a plugin configuration, GZAC pushes it to the host:
```
POST /api/host/configurations/{configId}
Headers:
  X-GZAC-Instance-Id: gzac-prod-1
  X-HMAC-Signature: <signature>
Body: {
  "pluginId": "risk-assessment",
  "pluginVersion": "1.2.0",
  "properties": { "apiKey": "decrypted-value", ... },
  "serviceToken": "eyJ...",
  "grantedCapabilities": [...],
  "eventSubscriptions": [...]
}
```
The host stores this in its in-memory configuration registry, keyed by `configId`, including the `gzacInstanceId` so it knows which GZAC instance owns this configuration.
**Token lifecycle**: The host maintains a background refresh loop per configuration:
- Tracks expiry of each service token (1-hour TTL)
- Refreshes at 75% of TTL (~45 minutes) via `POST {gzacBaseUrl}/api/v1/external-plugin/token/refresh` on the **owning GZAC instance** (authenticated with that instance's HMAC secret)
- On refresh failure, retries with exponential backoff (1s, 2s, 4s, 8s, max 60s)
- After 5 consecutive failures, marks affected plugin configuration as `DEGRADED` — action calls return 503
  **Configuration updates**: When an admin updates a plugin configuration's properties in GZAC, GZAC pushes the updated decrypted properties to the host via `PUT /api/host/configurations/{configId}`. The host updates its in-memory registry.
  **On host restart**: The host reloads GZAC instance registrations from its database and plugin packages from disk. Each GZAC instance re-registers on its next health check or polling cycle, pushing fresh service tokens and configuration data. Configurations are in `DEGRADED` state until the owning GZAC re-pushes them.
  **Per-plugin action/API calls** from GZAC to the host include the service token in the `Authorization` header and the `configurationId` in the request body. The host validates the token against its registry (using the owning GZAC instance's secret).
### 6.10 Hot-Reload
On plugin package upload (same `pluginId@version`):
1. Drop old Extism plugin instance (immediate — Wasm linear memory is freed)
2. Load new `.wasm` module into fresh Extism instance
3. Update frontend assets in serving directory
4. Update manifest in registry
   Unlike ClassLoader-based hot-reload (PF4J), Wasm module reload is:
- **Instant**: No garbage collection pressure, no memory leaks
- **Clean**: Old module is simply dropped; new module starts with fresh memory
- **Safe**: No risk of lingering threads, zombie listeners, or corrupted shared state
  Note: The same `.wasm` module version serves all configurations targeting that version. Hot-reload replaces the module for all configurations of that version simultaneously.
### 6.11 Resource Limits
The host enforces per-plugin resource limits via the Extism runtime:
- **Memory**: Maximum Wasm linear memory size (`max_pages` in Extism manifest, configurable, default 4096 pages = 256MB)
- **Execution time**: Per-call timeout (`timeout_ms`, configurable, default 30000ms)
  These are enforced by the Extism/Wasmtime runtime, not by convention.
### 6.12 Multi-Version Plugin Management
The host uses the composite key `pluginId@version` to identify a loaded plugin:
- **Storage layout**: `/plugins/{pluginId}/{version}/manifest.json`, `/plugins/{pluginId}/{version}/plugin.wasm`, `/plugins/{pluginId}/{version}/frontend/...`
- **Wasm instances**: Each `pluginId@version` gets its own Extism instance with independent linear memory
- **Configuration routing**: When a call arrives with a `configurationId`, the host looks up the configuration to find `pluginId` + `pluginVersion`, then routes to the correct Wasm instance
- **Unloading**: A specific version can only be unloaded when no active configurations reference it. The host returns an error listing the blocking configurations if removal is attempted.
- **Listing**: `GET /api/host/plugins` returns all versions of all plugins. `GET /api/host/plugins/{pluginId}` returns all versions of a specific plugin.
  This allows scenarios like:
- GZAC-prod running `risk-assessment@1.2.0`, GZAC-staging testing `risk-assessment@1.3.0-beta`
- Gradual rollout: some configurations on old version, some on new
- Two different GZAC instances using different versions of the same plugin
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
  // Routes to the correct GZAC instance automatically
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
        <form hx-post="/plugins/risk-assessment/1.2.0/pages/settings/save" hx-swap="innerHTML">
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
- Multi-GZAC routing — completely invisible to plugin code
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
  plugin_id           VARCHAR(255) NOT NULL,
  version             VARCHAR(64) NOT NULL,
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
  status              VARCHAR(32),
  UNIQUE(plugin_id, version)
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
**`base_url` for hosted plugins**: Computed as `{host.base_url}/plugins/{pluginId}/{version}` during discovery and stored in the definition. Updated if host base URL changes.
**`UNIQUE(plugin_id, version)`** allows multiple versions of the same plugin to coexist. Each GZAC instance's configurations reference a specific definition (which includes the version).
Notes:
- Properties encryption reuses the existing `EncryptionService` (AES/GCM/NoPadding, `valtimo.plugin.encryption-secret`). Schema `x-secret` fields are encrypted on save, decrypted on read.
- GZAC API access is controlled exclusively by `external_plugin_granted_endpoint`, not by capabilities. This avoids duplication.
  **Relationships to existing models:**
- New `ProcessLink` discriminator `"external_plugin"` → `ExternalPluginProcessLink`
- Case tabs: use existing `CaseTabType.CUSTOM` with `contentKey = "external-plugin:{pluginId}:{tabKey}"`
- Case widgets: use existing `CUSTOM` discriminator with `componentKey = "external-plugin:{pluginId}:{widgetKey}"`
- Dynamic menu items for page bundles via `MenuService.registerAppendMenuItemsFunction()`
### 8.2 Plugin Host Database (separate PostgreSQL instance)
The Plugin Host has its own database for plugin-scoped data, GZAC instance registrations, and API call logs.
```sql
gzac_instance (
  id                  VARCHAR(255) PK,    -- gzacInstanceId
  base_url            VARCHAR(1024) NOT NULL,
  secret_hash         VARCHAR(512) NOT NULL,  -- bcrypt hash of the instance secret
  version             VARCHAR(64),
  registered_at       TIMESTAMP,
  last_seen_at        TIMESTAMP
)
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
  gzac_instance_id    VARCHAR(255),
  http_method         VARCHAR(10),
  endpoint            VARCHAR(512),
  status_code         INT,
  timestamp           TIMESTAMP,
  duration_ms         BIGINT,
  request_summary     TEXT NULL,
  error_message       TEXT NULL
)
```
API logs are queryable via the Plugin Host API (`GET /api/host/plugins/{pluginId}/{version}/log`), which GZAC's admin UI calls. KV data is scoped per `plugin_config_id` — two configurations of the same plugin definition have completely separate KV namespaces. API logs include `gzac_instance_id` for traceability.
The `gzac_instance` table persists GZAC registrations so the host can survive restarts. The secret is stored as a bcrypt hash — the host only needs to verify incoming HMAC signatures, and for token refresh it uses the raw secret from the in-memory registry (populated when GZAC registers or re-registers). **Correction**: the host needs the raw secret for HMAC verification and for signing token refresh requests. The secret is stored encrypted (AES with a host-level key from `ENCRYPTION_KEY` env var) rather than hashed.
## 9. Discovery & Lifecycle
### 9.1 GZAC Version Endpoint
A new endpoint exposes the running GZAC version:
```
GET /api/v1/version → { "version": "13.1.3" }
```
The version is read from the application's build-info properties (populated by Gradle's `spring-boot-plugin` from `gradle.properties` `projectVersion`). Used by:
- Discovery polling to evaluate plugin compatibility
- Admin UI to display current version
### 9.2 Discovery via Polling
GZAC polls on configurable interval (default 60s):
- `GET /api/host/plugins` on each registered host to detect loaded plugins (returns all versions)
- `GET /plugin-manifest` on each registered URL plugin
- Cached via ETag/If-None-Match
- New plugin version → store definition with `pluginId + version`, mark `AVAILABLE`
- Plugin version gone → mark that version `UNAVAILABLE` after sustained failure (configurable: default 3 consecutive failures), then deactivate configurations targeting that version
- Same `pluginId` with new version → new definition record (not a conflict — both versions coexist)
  Host health: `GET /health` on each host (simple JSON response). Individual Wasm plugin health is implicit — if the host is up and the plugin version is loaded, it's healthy. Failed Wasm calls are reported per-invocation.
### 9.3 External Plugin States
```
AVAILABLE → ACTIVE ⇄ DISABLED
                ↓
           UNAVAILABLE (plugin version disappeared or host unreachable)
```
- **AVAILABLE**: Discovered, no configuration yet
- **ACTIVE**: Configured, permissions granted, operational
- **DISABLED**: Deactivated (manually or automatically)
- **UNAVAILABLE**: Plugin version no longer reachable (host down, version removed)
### 9.4 Activation
Admin creates configuration + grants permissions + grants capabilities → ACTIVE:
- Service token issued to Plugin Host (hosted) or returned to plugin (URL)
- For hosted plugins: GZAC pushes decrypted configuration properties to the host's in-memory registry, including `pluginId` and `pluginVersion` so the host knows which Wasm module to route to
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
- Plugin version removed from host
- Plugin upgrade makes configuration incompatible
## 10. Upgrade Flow
When a new version of a plugin is detected on the host (e.g. `risk-assessment@1.3.0` appears alongside `risk-assessment@1.2.0`):
1. GZAC stores the new version as a new `external_plugin_definition` record — the old version's record and configurations are **untouched**
2. The admin sees both versions in the management UI
3. The admin can:
    - Create new configurations targeting the new version
    - Migrate existing configurations from old to new version:
      a. Open existing configuration → "Upgrade to version" action
      b. New config screen (iframe from new version's bundle) → prefilled with old config via SDK `onPrefillConfiguration`
      c. If new `configurationSchema.required` fields are missing → admin fills them in
      d. If permissions changed → admin reviews and re-grants
      e. Save → old configuration deactivated, new configuration created targeting new version
4. Once all configurations are migrated off an old version, the admin (or operator) can remove the old version from the host
   This is a **non-breaking upgrade path** — old and new versions run simultaneously. No configurations are auto-deactivated by a version change. The admin has full control over the migration timeline.
## 11. Security
### 11.1 Wasm Sandbox (Plugin Host)
The Extism/Wasmtime sandbox is the primary security boundary for hosted plugins:
- Plugins execute in isolated linear memory with bounds checking
- No filesystem, network, or syscall access unless granted via host functions
- Host functions are the **only** way plugins interact with the outside world
- Each plugin version gets its own Extism instance — plugins cannot see or affect each other
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
  "plugin_version": "1.2.0",
  "iss": "valtimo-gzac",
  "gzac_instance_id": "gzac-prod-1",
  "exp": "<now + 1h>"
}
```
Each plugin configuration gets its own service token. If a plugin definition has 3 configurations, 3 separate tokens exist, each scoped to its own `plugin_config_id` and its own granted endpoints. The `gzac_instance_id` claim identifies which GZAC issued the token.
**Claim discriminator:** `type: "external_plugin_service"` distinguishes these from Keycloak tokens. The existing `TokenAuthenticationService` iterates `TokenAuthenticator` beans via `stream().filter(supports()).findFirst()`. A new `ExternalPluginServiceTokenAuthenticator` implements `TokenAuthenticator`:
- `supports(claims)` → checks `claims["type"] == "external_plugin_service"` (returns true before the Keycloak authenticator which checks for `email`)
- `authenticate()` → creates `Authentication` with `ExternalPluginServicePrincipal` (no `GrantedAuthority` roles)
  **No roles granted.** Endpoint access controlled entirely by the allowlist filter (section 11.3). Prevents external plugins from bypassing PBAC or accessing any endpoint not explicitly granted.
  **Key management:** Dedicated `ExternalPluginSecretKeyProvider` implements `SecretKeyProvider` with a separate HMAC-SHA256 signing secret (`valtimo.external-plugin.service-token-secret`). Independent from Keycloak RSA keys.
  **Token lifecycle:**
- For hosted plugins: The Plugin Host manages token refresh (see section 6.9). The Wasm plugin never sees the raw token — the host injects it into outbound GZAC requests using the token mapped to the current call's `configurationId`. The host refreshes against the **owning GZAC instance**.
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
All requests from external plugin service tokens logged to `external_plugin_api_log` (in the host's database), scoped by `plugin_config_id` and `gzac_instance_id`. All host function calls logged. Truncated summaries, no secrets. Viewable in admin UI (GZAC admin UI queries host API). Configurable retention (default 30 days) with background cleanup in the Plugin Host.
### 11.8 GZAC Instance Isolation
Multiple GZAC instances share the same Plugin Host but are isolated from each other:
- **Configuration isolation**: Each configuration is owned by a specific GZAC instance. The host routes `gzac_api` calls to the owning instance only.
- **Secret isolation**: Each GZAC instance has its own HMAC secret. A compromised instance cannot forge requests for another instance's configurations.
- **Token isolation**: Service tokens are scoped to a configuration and signed with the owning GZAC instance's secret. A token from GZAC-1 cannot be used against GZAC-2.
- **KV isolation**: KV data is scoped by `configurationId`, which is globally unique (UUID). Configurations from different GZAC instances cannot access each other's KV data.
- **Log traceability**: API logs include `gzac_instance_id` for per-instance filtering.
  A GZAC instance can only manage (push/update/remove) its own configurations. The host validates `gzacInstanceId` ownership on every configuration mutation.
### 11.9 Security Summary
| Layer | Hosted Plugins (Wasm) | URL Plugins |
|-------|----------------------|-------------|
| Backend code isolation | Wasm sandbox (memory, fs, network) | Process-level (separate service) |
| GZAC API access | Host function → service token (per-config), routed to owning GZAC | Direct HTTP with service token (per-config) |
| GZAC API restriction | Endpoint allowlist per configuration | Endpoint allowlist per configuration |
| External HTTP access | Host function with URL allowlist | Unrestricted (their own process) |
| Frontend isolation | Iframe sandbox + CSP + cross-origin | Iframe sandbox + CSP + cross-origin |
| User-context API calls | Downscoped user token | Downscoped user token |
| Resource limits | Wasm memory + timeout | N/A (their own infra) |
| Configuration secrets | Decrypted by GZAC, held in host memory only | Sent per-call (inline) or pushed on activation |
| GZAC instance isolation | Per-instance secrets, config ownership, routing | N/A (URL plugins talk to one GZAC) |
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
  Note: In a multi-GZAC setup, each GZAC instance has its own RabbitMQ (or vhost). The Plugin Host connects to multiple RabbitMQ instances — one per GZAC instance. The RabbitMQ URL is provided during GZAC instance registration.
### 12.2 Event Delivery Per Hosting Mode
**URL Plugins**: Consume directly from their dedicated RabbitMQ queue. Credentials delivered during activation (see 12.5).
**Hosted Plugins (Wasm)**: The Plugin Host consumes from each configuration's RabbitMQ queue using `amqplib`. On message receipt, it looks up the `configurationId` from the queue name, retrieves the corresponding decrypted configuration from its registry (including `pluginId` and `pluginVersion`), and calls the correct Wasm module version's `handle_event` function with both the event data and the configuration context.
### 12.3 Flow
1. Manifest declares desired events in `permissions.events`
2. Admin grants event access during configuration activation
3. On activation, GZAC:
    - Creates dedicated RabbitMQ queue: `external-plugin.{configId}` (quorum queue)
    - Creates bindings to `valtimo-external-plugin-events` exchange for each granted event routing key
    - For URL plugins: creates dedicated RabbitMQ user with read permission on its queue only
    - For hosted plugins: GZAC provides RabbitMQ connection details during configuration push so the Plugin Host can consume from the queue
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
### 12.6 RabbitMQ Connection Management (Plugin Host)
The Plugin Host manages RabbitMQ connections per GZAC instance:
- Each GZAC instance provides its RabbitMQ connection details during registration (or during configuration push)
- The host maintains a connection pool: `gzacInstanceId → amqplib connection`
- When a configuration is activated, the host starts consuming from the configuration's queue on the correct RabbitMQ instance
- Connections are shared across configurations from the same GZAC instance
- Reconnect with exponential backoff on connection loss
### 12.7 SDK Event Handler
```typescript
import { onEvent, config, log } from "@valtimo/external-plugin-sdk";
// config.getAll() returns the configuration for this specific invocation
onEvent("DocumentCreated", async (event) => {
  const cfg = await config.getAll();
  log.info(`Document created: ${event.data.documentId}, using API at ${cfg.baseUrl}`);
});
```
### 12.8 Lifecycle
- **Deactivation** → queue unbound, RabbitMQ user credentials revoked (URL plugins), host stops consuming (hosted plugins)
- **Reactivation** → queue rebound, new credentials issued (URL plugins), host resumes consuming (hosted plugins)
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
Every iframe context includes `pluginConfigurationId` so the iframe (and the plugin host, for hosted plugins) knows which configuration applies. Bundle URLs are version-scoped (e.g. `{hostBaseUrl}/plugins/{pluginId}/{version}/bundles/config.js`).
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
1. `ExternalPluginIframeComponent` sets iframe `src` to the plugin's HTMX page URL on the host (e.g. `{hostBaseUrl}/plugins/{pluginId}/{version}/pages/settings?configId={configId}`)
2. Host serves initial HTML page (static from package or dynamic from Wasm `render_page`), injecting the configuration context into the Wasm call
3. Page includes HTMX library (from host's `/shared/htmx.min.js`) and `external-plugin-htmx-bridge.js`
4. Subsequent HTMX interactions (`hx-get`, `hx-post`) are routed to the host, which calls `render_page` in the Wasm module with the configuration context and returns HTML partials
5. Authentication: Bridge script receives access token via postMessage `init` event, injects into HTMX requests via `htmx:configRequest`
6. Communication with Angular parent: Same postMessage protocol as JS bundles
### 13.7 Process Link Integration
New `ExternalPluginProcessLink` follows the existing extension pattern with discriminator `"external_plugin"` on the `process_link` table:
**Backend:**
- Entity: `ExternalPluginProcessLink` with `@DiscriminatorValue("external_plugin")` extending `ProcessLink`. Uses the new columns `external_plugin_config_id`, `external_plugin_action_key`, `external_plugin_action_properties` on the `process_link` table. The `external_plugin_config_id` points to a specific configuration — this is how the runtime knows which configuration (and therefore which plugin version) to use when the process link fires.
- `ExternalPluginProcessLinkMapper` implementing `ProcessLinkMapper`:
    - `supportsProcessLinkType("external_plugin")`
    - `toProcessLinkResponseDto()` / `toNewProcessLink()` / `toUpdatedProcessLink()`
    - `createRelatedExportRequests()` — exports the external plugin definition reference
    - `afterImport()` — validates that the referenced external plugin definition exists and is active; publishes `CaseConfigurationIssueDetectedEvent` if not found
- `ExternalPluginProcessLinkActivityHandler` implementing `ProcessLinkActivityHandler`
- `ExternalPluginSupportedProcessLinkTypeHandler` implementing `SupportedProcessLinkTypeHandler`
  **Frontend:** Process link modal extended with a new step for discovering external plugins, selecting a configuration (which implicitly selects a version), and configuring the action.
## 14. Process Link Actions
1. Process reaches linked activity → Operaton listener fires → `ProcessLinkActivityService` finds `ExternalPluginProcessLink`
2. `ExternalPluginProcessLinkActivityHandler` fires
3. Read `external_plugin_config_id` from the process link to determine which configuration to use
4. Resolve action properties via `ValueResolverService` (`doc:`, `pv:`, etc.) — same mechanism as existing plugins
5. Look up configuration → get `pluginId`, `version`, `hostBaseUrl`
6. GZAC calls `POST {hostBaseUrl}/plugins/{pluginId}/{version}/actions/{actionKey}` with the configuration's service token (for hosted plugins) or `POST {pluginBaseUrl}/actions/{actionKey}` (for URL plugins)
7. For hosted plugins: Host looks up configuration by `configurationId`, verifies it targets the requested plugin version, injects decrypted properties into Wasm call
8. For URL plugins: Request body includes full configuration (inline mode) or just `configurationId` (push mode)
9. Body: `{ "configurationId": "...", "configuration": {...}, "processInstanceId": "...", "documentId": "...", "activityId": "...", "properties": {...} }`
10. Response: `{ "status": "completed", "variables": {...} }`
11. Variables written to process via Operaton API
    **Error handling:**
- Configurable timeout (default 30s) and retry (count + exponential backoff)
- 4xx → `BpmnError` (catchable in process)
- 5xx / timeout exhausted → Operaton incident
- Wasm execution timeout → Operaton incident with "plugin execution timeout" message
## 15. Compatibility
- On GZAC upgrade: check all active external plugin definitions against the version from `GET /api/v1/version`
- Plugin has `maxGzacVersion` and GZAC exceeds it → auto-deactivate all configurations targeting that plugin version, notify admin
- Plugin has no `maxGzacVersion` → stays active
- Plugin upgrade with incompatible config schema → admin decides when to migrate (see section 10)
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
├── plugin-host/
│   └── app/                               # NEW (Node.js application)
│       ├── src/
│       │   ├── index.ts                   # Entry point, Fastify setup
│       │   ├── plugin-manager.ts          # Manages Wasm plugin lifecycle (version-aware)
│       │   ├── config-registry.ts         # In-memory configId → {properties, token, gzacInstanceId, pluginVersion}
│       │   ├── gzac-registry.ts           # In-memory + DB gzacInstanceId → {baseUrl, secret}
│       │   ├── host-functions/
│       │   │   ├── http-request.ts
│       │   │   ├── gzac-api.ts            # Routes to correct GZAC instance
│       │   │   ├── log.ts
│       │   │   ├── config.ts
│       │   │   └── kv-store.ts
│       │   ├── routes/
│       │   │   ├── host-management.ts     # /api/host/plugins (version-aware)
│       │   │   ├── gzac-instances.ts      # /api/host/gzac-instances (registration)
│       │   │   ├── host-configurations.ts # /api/host/configurations (push from GZAC)
│       │   │   ├── plugin-actions.ts      # /plugins/:id/:version/actions/:key
│       │   │   ├── plugin-api.ts          # /plugins/:id/:version/api/*
│       │   │   ├── plugin-pages.ts        # /plugins/:id/:version/pages/*
│       │   │   └── plugin-bundles.ts      # /plugins/:id/:version/bundles/*
│       │   ├── events/
│       │   │   └── event-consumer.ts      # RabbitMQ → Wasm delivery (per-config queue, multi-instance)
│       │   ├── security/
│       │   │   ├── admin-auth.ts          # ADMIN_TOKEN authentication for management API
│       │   │   ├── hmac-auth.ts           # Per-GZAC-instance HMAC authentication
│       │   │   ├── token-validator.ts     # Service token validation for plugin calls
│       │   │   └── capability-guard.ts    # Host function access control
│       │   ├── token/
│       │   │   └── token-manager.ts       # Per-config service token lifecycle & refresh (routes to correct GZAC)
│       │   ├── db/
│       │   │   ├── migrations/            # Host database migrations
│       │   │   ├── kv-store.ts
│       │   │   ├── api-log.ts
│       │   │   └── gzac-instance-store.ts
│       │   └── config.ts                  # Environment configuration
│       ├── package.json
│       ├── tsconfig.json
│       └── Dockerfile
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
| POST | `/host` | Register new host |
| PUT | `/host/{hostId}` | Update host |
| DELETE | `/host/{hostId}` | Remove host |
| GET | `/definition` | List external plugin definitions (all versions) |
| GET | `/definition/{pluginId}` | List all versions of a plugin |
| GET | `/definition/{pluginId}/{version}` | Get specific version details |
| POST | `/url-plugin` | Register URL plugin |
| DELETE | `/url-plugin/{pluginId}` | Remove URL plugin |
| GET | `/configuration` | List configurations (optionally filtered by definition) |
| POST | `/configuration` | Create configuration (activate) — includes target plugin version |
| PUT | `/configuration/{configId}` | Update configuration |
| DELETE | `/configuration/{configId}` | Delete configuration |
| POST | `/configuration/{configId}/activate` | Activate |
| POST | `/configuration/{configId}/deactivate` | Deactivate |
| POST | `/configuration/{configId}/upgrade` | Upgrade to new version |
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
| POST | `/api/host/gzac-instances` | Admin token | Register GZAC instance |
| PUT | `/api/host/gzac-instances/{gzacInstanceId}` | Admin token | Update GZAC instance |
| DELETE | `/api/host/gzac-instances/{gzacInstanceId}` | Admin token | Remove GZAC instance |
| GET | `/api/host/gzac-instances` | Admin token | List registered GZAC instances |
| GET | `/api/host/plugins` | Admin token | List all loaded plugins (all versions) |
| GET | `/api/host/plugins/{pluginId}` | Admin token | List all versions of a plugin |
| POST | `/api/host/plugins` | Admin token | Upload plugin package (version from manifest) |
| DELETE | `/api/host/plugins/{pluginId}/{version}` | Admin token | Unload and remove specific version |
| GET | `/api/host/plugins/{pluginId}/{version}/status` | Admin token | Plugin runtime status |
| GET | `/api/host/plugins/{pluginId}/{version}/log` | GZAC HMAC | Query API call logs |
| POST | `/api/host/configurations/{configId}` | GZAC HMAC | Push configuration from GZAC |
| PUT | `/api/host/configurations/{configId}` | GZAC HMAC | Update configuration from GZAC |
| DELETE | `/api/host/configurations/{configId}` | GZAC HMAC | Remove configuration |
| GET | `/health` | None | Host health check |
| GET | `/plugins/{pluginId}/{version}/plugin-manifest` | None | Plugin manifest |
| GET | `/plugins/{pluginId}/{version}/bundles/**` | None | Frontend bundles (public) |
| GET | `/plugins/{pluginId}/{version}/pages/**` | Token | HTMX pages |
| POST | `/plugins/{pluginId}/{version}/actions/{actionKey}` | Token | Execute action |
| * | `/plugins/{pluginId}/{version}/api/**` | Token | Generic plugin API |
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
      VALTIMO_EXTERNAL_PLUGIN_SERVICE_TOKEN_SECRET: ${GZAC_PLUGIN_SECRET}
      VALTIMO_EXTERNAL_PLUGIN_HOST_URL: http://plugin-host:8090
      VALTIMO_EXTERNAL_PLUGIN_HOST_ADMIN_TOKEN: ${PLUGIN_HOST_ADMIN_TOKEN}
  plugin-host:
    image: ritense/gzac-plugin-host:latest
    ports:
      - "8090:8090"
    volumes:
      - plugin-storage:/plugins
    environment:
      ADMIN_TOKEN: ${PLUGIN_HOST_ADMIN_TOKEN}
      DATABASE_URL: postgresql://plugin-host-db:5432/plugin_host
      ENCRYPTION_KEY: ${PLUGIN_HOST_ENCRYPTION_KEY}
      LOG_LEVEL: info
      PORT: 8090
      PLUGIN_STORAGE_DIR: /plugins
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
Note: The Plugin Host no longer has `GZAC_BASE_URL`, `RABBITMQ_URL`, or `SERVICE_TOKEN_SECRET` in its environment. These are provided per GZAC instance during registration. The host only needs its own `ADMIN_TOKEN` (for management API auth), `DATABASE_URL`, `ENCRYPTION_KEY` (for encrypting stored GZAC secrets), and standard operational settings.
**Multi-GZAC deployment:**
```yaml
services:
  gzac-prod:
    image: ritense/gzac:13.1.3
    environment:
      VALTIMO_EXTERNAL_PLUGIN_SERVICE_TOKEN_SECRET: ${GZAC_PROD_SECRET}
      VALTIMO_EXTERNAL_PLUGIN_HOST_URL: http://plugin-host:8090
      VALTIMO_EXTERNAL_PLUGIN_HOST_ADMIN_TOKEN: ${PLUGIN_HOST_ADMIN_TOKEN}
  gzac-staging:
    image: ritense/gzac:14.0.0-rc1
    environment:
      VALTIMO_EXTERNAL_PLUGIN_SERVICE_TOKEN_SECRET: ${GZAC_STAGING_SECRET}
      VALTIMO_EXTERNAL_PLUGIN_HOST_URL: http://plugin-host:8090
      VALTIMO_EXTERNAL_PLUGIN_HOST_ADMIN_TOKEN: ${PLUGIN_HOST_ADMIN_TOKEN}
  plugin-host:
    image: ritense/gzac-plugin-host:latest
    environment:
      ADMIN_TOKEN: ${PLUGIN_HOST_ADMIN_TOKEN}
      DATABASE_URL: postgresql://plugin-host-db:5432/plugin_host
      ENCRYPTION_KEY: ${PLUGIN_HOST_ENCRYPTION_KEY}
    # Both GZAC instances register themselves on startup
    # Plugin host loads risk-assessment@1.2.0 and risk-assessment@1.3.0-beta
    # gzac-prod configurations use 1.2.0, gzac-staging configurations use 1.3.0-beta
```
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
// If two configurations exist (even on different GZAC instances), this code runs with the
// appropriate config each time. The plugin doesn't know or care which GZAC instance it serves.
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
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@risk-assessment-1.2.0.zip"
```
Deploy a second version alongside the first:
```bash
curl -X POST http://plugin-host:8090/api/host/plugins \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@risk-assessment-1.3.0-beta.zip"
```
Both versions are now loaded and available. Each GZAC instance can create configurations targeting either version.
**6. Configure in GZAC admin UI**
- GZAC discovers available plugin versions via host polling
- Admin selects a plugin version and creates one or more configurations
- Admin grants permissions and capabilities per configuration
- Each configuration becomes independently active, targeting a specific version
## 20. Cleanup on Removal
When a plugin version is fully removed (not just deactivated):
1. Verify no active configurations reference this version (fail if any do)
2. All configurations' service tokens revoked
3. All configurations deleted
4. Granted endpoints and capabilities deleted
5. Event subscriptions deleted, per-configuration RabbitMQ queues deleted, RabbitMQ users removed (URL plugins)
6. `CaseTab` entries with matching `contentKey` prefix deleted
7. `external_plugin_page` entries deleted (menu items removed dynamically on next page load)
8. Plugin definition deleted
9. **Active process instances** with `ExternalPluginProcessLink` references are **not** altered — they will produce Operaton incidents on next execution (by design; admin should resolve process instances before removal)
10. KV store data for all plugin configurations deleted from host database
11. API log entries retained for configurable period (default 30 days), then purged
12. For push-based URL plugins: `DELETE {pluginBaseUrl}/configurations/{configId}` for each configuration
13. Wasm module unloaded, files removed from storage
    When a GZAC instance is removed from the host:
1. All configurations owned by that GZAC instance are removed from the host's registry
2. All service tokens for those configurations are dropped
3. RabbitMQ consumers for those configurations are stopped
4. The GZAC instance record is removed from the host database
5. Plugin versions remain loaded (they may serve other GZAC instances)
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
12. **GZAC instance auto-registration:** Should GZAC auto-register with the host on startup using the configured `VALTIMO_EXTERNAL_PLUGIN_HOST_URL` and `ADMIN_TOKEN`? Recommendation: yes — GZAC calls the host's registration endpoint during application startup, providing its own secret. This makes the multi-GZAC flow seamless.
13. **Plugin version garbage collection:** Should the host auto-unload plugin versions that have zero active configurations for a configurable period? Recommendation: no for v1 — explicit unload only. Add as optional feature later.
