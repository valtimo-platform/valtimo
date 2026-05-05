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
