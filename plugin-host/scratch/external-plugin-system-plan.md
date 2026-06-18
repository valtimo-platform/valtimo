# External Plugin System — Plan

External plugins extend the platform with sandboxed JS/TS backend logic and iframe-based
frontends without rebuilding the core app. A **definition** is a `pluginId@version` discovered on
a host; a definition may have multiple **configurations**, each with its own encrypted properties,
granted permissions, and a per-configuration service token. Hosted plugins run as `.wasm` modules
in the plugin host's Extism sandbox. Plugins can run **actions** (synchronous, invoked from a
process service task) and react to **events** (asynchronous, delivered from the core app's event
stream).

Naming: prose says "core app" / "GZAC instance" / "host"; code identifiers keep their literal
names (`gzac`, `valtimo.*` properties, `external_plugin_*` tables, the `external_plugin_service`
token type).

Status legend: ✅ implemented & verified · 🟡 implemented, POC-level · ⛔ not implemented.

## 1. Components

| Area | Path | Status |
|------|------|--------|
| Core-app backend module | `backend/external-plugin/` | ✅ |
| Endpoint-description providers (per module) + contract | `backend/*/.../endpoint/*EndpointDescriptionProvider.kt`, `com.ritense.valtimo.contract.endpoint.EndpointDescriptionProvider` | ✅ |
| Plugin host (Node + Fastify + Extism, multi-version) | `plugin-host/app/` | 🟡 |
| Event consumer (RabbitMQ → `handle_event`) | `plugin-host/app/src/rabbitmq/event-consumer.ts` | ✅ |
| Backend plugin SDK (`@valtimo/plugin-sdk`) — actions, events, `gzacApi`, frontend `t()` | `plugin-host/plugin-sdk/` | ✅ |
| Shared manifest validation (name/description-in-translations), one rule set for pack + host | `plugin-host/plugin-sdk/src/manifest-validation.ts` (subpath `@valtimo/plugin-sdk/manifest-validation`) | ✅ |
| Sample plugin (action + event handler + logo + i18n) | `plugin-host/sample-plugins/case-summary/` | ✅ |
| Frontend management UI + external models/service/iframe | `frontend/projects/valtimo/{plugin-management,plugin}/` | ✅ |
| Process-link (`SERVICE_TASK_START`) | `backend/external-plugin/.../processlink/` + frontend process-link | 🟡 |
| Per-host broker / callback config + defaults endpoint | `backend/external-plugin/.../web/rest/ExternalPluginManagementResource.kt#hostDefaults` | ✅ |
| Per-host durable event queue mode + TTL (live/durable, `x-expires`) + narrow PATCH endpoint | `backend/external-plugin/.../domain/EventQueueMode.kt`, `service/ExternalPluginHostService.updateEventQueue`, `web/rest/...#updateHostEventQueue` ↔ `plugin-host/app/src/rabbitmq/event-consumer.ts` | ✅ |
| Plugin assets (logo + i18n bundle in manifest, served by host) | `plugin-host/plugin-sdk/bin/valtimo-plugin-pack.mjs`, `plugin-host/app/src/routes/plugin-bundles.ts` | ✅ |
| GZAC→host auth on **every** route (HMAC-SHA256, replay-protected, body-bound): actions, config-push, management | `client/ExternalPluginHostClient.kt` + `security/ExternalPluginHmacSigner.kt` ↔ `plugin-host/app/src/security/{hmac,hmac-auth}.ts`, `routes/{plugin-actions,host-configurations,host-management}.ts` | ✅ |
| Transport confidentiality (TLS): host serves HTTPS from `TLS_*`; broker credentials confined to a confidential transport at host registration | `plugin-host/app/src/index.ts` (`buildHttpsOptions`) + `models/app-config.ts` ↔ `service/ExternalPluginHostService.isSecureTransport` | ✅ |
| GZAC compatibility check (semver range vs running version): comparator + version provider + zip manifest peek; non-blocking UI warnings, upload confirm-gate | `backend/external-plugin/.../compatibility/*` + `web/rest/ExternalPluginManagementResource.kt#uploadPlugin` ↔ frontend `plugin-management/.../utils/external-plugin-compatibility.util.ts` | ✅ |
| Strict delete guards (embedded + external), shared usage DTO/resolver + `/usages` endpoints + read-only in-use modal, no force override | core `backend/plugin/.../{web/rest/dto/PluginUsageDto, service/ProcessDefinitionUsageMetaResolver, service/PluginConfigurationUsageResolver, exception/PluginConfigurationInUseException}` + `backend/external-plugin/.../{service/ExternalPluginHostUsageResolver, exception/ExternalPlugin*InUseException}` ↔ frontend `plugin-management/.../plugin-usage-modal/` | ✅ |

Single-core-app model with **multiple hosts per instance**: the core app pushes each configuration
directly to its host with a freshly issued service token, a `gzacBaseUrl` callback target taken
from the host row, and an optional `eventBroker` block also taken from the host row. Definitions
are discovered by polling each host (`GET /api/host/plugins`, default 60s) and stored with
`UNIQUE(plugin_id, version)`.

## 2. Zero-configuration deployment

The external-plugin module ships with **no additional `application.yml` entries** beyond what the
rest of Valtimo already requires. Every value the module needs is either:

- **Per-host**, entered once in the add-host UI (host base URL, admin token, callback URL,
  optional broker URL/exchange) and stored on the host row, **or**
- **Derived from existing platform config** at runtime (the JWT signing key, the broker exchange
  fallback, the legacy callback fallback).

| What the module needs | Where it comes from | When |
|----------------------|---------------------|------|
| JWT signing key | `SHA-256(valtimo.plugin.encryption-secret)` | At every JWT issue/verify. The hash gives a stable 32-byte HmacSHA256 key regardless of the encryption secret's raw length, so AES-128 (16-byte) and AES-256 (32-byte) deployments both work without reconfiguration. Hashing also keeps the signing key cryptographically separate from the AES key. |
| `gzacBaseUrl` per push | `external_plugin_host.gzac_callback_base_url` | Set in the add-host UI; default pre-fill is `http://localhost:{server.port}` because the admin's browser URL (often the Angular dev proxy at `:4200` or a reverse proxy in production) is not a reliable signal for the URL plugin hosts should call back on. |
| Broker AMQP URL per push | `external_plugin_host.event_broker_amqp_url` (nullable) | Set in the add-host UI; default pre-fill built from `spring.rabbitmq.*`. Null disables events for hosts under this host (actions still work). A non-null broker URL requires the host base URL to be a confidential transport (HTTPS, or a loopback address for local dev); registration is rejected otherwise so AMQP credentials never travel over plaintext (§3.9). |
| Broker exchange per push | `external_plugin_host.event_broker_exchange`, else `valtimo.outbox.publisher.rabbitmq.exchange` | Set in the add-host UI; default pre-fill from the outbox exchange, which is what GZAC itself publishes to. |
| Broker exchange type | hardcoded `fanout` | Matches the outbox publisher and the exchange declared in `imports/gzac-rabbitmq/definitions.json`. |
| Queue mode per push (`live`/`durable`) | `external_plugin_host.event_queue_mode` (default `LIVE`) | Set in the add-host UI and editable later via `PATCH .../host/{id}/event-queue` (§8.4). Drives the host's `assertQueue` arguments. |
| Queue inactivity TTL per push (ms) | `external_plugin_host.event_queue_ttl_ms` (nullable; required when mode is `DURABLE`) | Validated to `[1h, 30d]`, default 72h. Maps to RabbitMQ `x-expires`; ignored (forced null) in `LIVE` mode. |

The module requires **no entries** in `backend/app/gzac/src/main/resources/application.yml`.

## 3. Endpoint-scoped service token & permission enforcement ✅

A plugin gets a token scoped to exactly the API endpoints its configuration was granted, enforced
per-request with deny-by-default. The same token authenticates both action callbacks and event
callbacks.

**3.1 Activation stores grants (`service/ExternalPluginConfigurationService.kt`)**
- `create()` validates properties against the definition JSON schema, then
  `validateGrantedEndpointsCoverManifest()` **rejects the configuration unless every endpoint
  declared in the manifest is granted** — permissions are all-or-nothing.
- `create()` likewise runs `validateGrantedEventsCoverManifest()` — the same all-or-nothing gate
  applied to `manifest.eventSubscriptions`. Both `grantedEndpoints` and `grantedEvents` are
  **required** parameters of `create()`; event grants are enforced at the service layer, not only
  in the UX (§4).
- Grants persist to `external_plugin_granted_endpoint` (`configuration_id`, `http_method`,
  `endpoint_pattern`) and `external_plugin_granted_event` (`configuration_id`, `event_type`);
  `update()` with non-null `grantedEndpoints` replaces the endpoint grants, null leaves them
  unchanged. `update()` has **no** `grantedEvents` parameter — event grants cannot change after
  activation.

**3.2 Token (`service/ExternalPluginServiceTokenService.kt`)** — HS256 JWT:
`sub=external-plugin:{pluginId}:{configId}`, `type=external_plugin_service`, `plugin_config_id`,
`plugin_id`, `plugin_version`, `iss=valtimo-gzac`, `exp=now+24h`. **No roles.** Signed with
`SHA-256(valtimo.plugin.encryption-secret)` — see `security/ExternalPluginServiceTokenKeyProvider.kt`.

**3.3 Recognition (`security/ExternalPluginServiceTokenFilter.kt`)** — registered **before**
`BearerTokenAuthenticationFilter` (`security/ExternalPluginCallbackHttpSecurityConfigurer.kt`,
`@Order(450)`): parses the bearer JWT with the plugin signing key; passes through if signature or
`type` claim don't match (Keycloak tokens untouched); on match sets an
`ExternalPluginServicePrincipal`, **strips the `Authorization` header**, and runs the rest of the
chain inside `AuthorizationContext.runWithoutAuthorization` (PBAC is intentionally bypassed for
service tokens — the allowlist is the sole gate).

**3.4 Enforcement (`security/ExternalPluginEndpointAllowlistFilter.kt`)** — registered **after**
`BearerTokenAuthenticationFilter`:
1. Principal not `ExternalPluginServicePrincipal` → pass through (users and existing plugins
   unaffected).
2. Request to `/api/management/v1/external-plugin/**` → 403 (a plugin can never reach its own
   management API).
3. Load grants for `plugin_config_id`, match request via `AntPathRequestMatcher(pattern, method)`;
   no match → 403; empty grants → deny.

**3.5 Host callback** — the host's `gzac_api` host function
(`plugin-host/app/src/host-functions/gzac-api.ts`) attaches the per-config `serviceToken` as
`Authorization: Bearer` to `${gzacBaseUrl}${path}`, forwarding method, JSON body, and headers. The
token is passed via Extism `hostContext`, never serialised into the Wasm input — plugin code never
sees it. This is the same mechanism for both action handlers and event handlers.

**3.6 Token lifecycle** — 24h TTL, **no separate refresh loop**. Each healthy discovery poll
re-pushes every configuration with a freshly issued token
(`service/ExternalPluginDiscoveryService.syncConfigurations()`), continuously replacing tokens
well inside their lifetime.

**3.7 Caveat** — service tokens bypass PBAC, so the allowlist is the entire authorization surface;
an over-broad grant (`/api/v1/**`) gives broad role-free access. Hence the activation-time
acceptance screen (§4) is security-critical.

**3.8 Manifest field naming.** The endpoint allowlist lives at `permissions.endpoints` in the
manifest. The same declaration is the source of truth for both the service-token allowlist (this
section) and the upcoming iframe user-token path (§13) — one block, two consumers. SDK type
`Endpoint`, Kotlin DTO `GrantedEndpointEntry`, frontend type `ExternalPluginEndpoint`.

**3.9 Reverse direction — GZAC→host authentication (HMAC), every route ✅.** Calls that flow the
*other* way (core app → host) are authenticated with an HMAC-SHA256 signature, not the service
token. Every GZAC→host route is covered: action invocations, config-push, and host management. The
client signs `{METHOD}\n{path}\n{timestamp}\n{bodyHash}` (`bodyHash = SHA-256(body)` hex,
`timestamp = Instant.now()` ISO-8601) with the host's **decrypted secret**
(`security/ExternalPluginHmacSigner`), and sends `X-Valtimo-Signature` + `X-Valtimo-Timestamp`. The
HMAC key is therefore the host's admin token (`hostService.decryptedSecret(host)` == the host's
`ADMIN_TOKEN`); the secret is always carried as a signature, never as a bearer token.
`client/ExternalPluginHostClient` signs through one `hmacHeaders(secret, method, path, body)` helper
for all five calls (`invokeAction`, `pushConfiguration`, `deleteConfiguration`, `listPlugins`,
`uploadPlugin`).

The host verifies in a shared Fastify `preHandler` (`createHmacAuthHook`,
`plugin-host/app/src/security/hmac-auth.ts`, delegating to `security/hmac.ts`): headers present,
±5-min timestamp window (replay protection), timing-safe compare against
`computeSignature(ADMIN_TOKEN, …)`. The hook is the action route's `preHandler` and a plugin-level
`preHandler` on both `routes/host-configurations.ts` and `routes/host-management.ts`.

**Body binding per route shape:**
- **JSON-body routes** (action POST; config-push POST/PUT) opt in to raw-body capture
  (`config: { rawBody: true }` + `fastify-raw-body`) and bind the exact request bytes. The
  config-push body carries the freshly issued service token and broker credentials — binding it is
  what stops a replayed/forged push from installing a swapped token or broker.
- **No-body routes** (config GET/DELETE; management GET/DELETE) bind an empty body
  (`SHA-256("")`), so method + path + timestamp are still signed.
- **Multipart upload** (`POST /api/host/plugins`) cannot bind the multipart envelope — RestTemplate
  generates the boundary internally, so the client cannot reproduce the wire bytes to hash. Instead
  both sides hash the **uploaded file bytes** (the `.zip`). The route is flagged
  `config: { deferHmac: true }` so the shared hook skips it, and the handler runs
  `verifyDeferredHmac(...)` once it has read the file into a buffer.

- **Caveat 1 (path prefix):** the signed `path` is the bare route path (`/plugins/...`,
  `/api/host/...`); the host verifies `request.url` minus the query string. A reverse proxy that
  prepends a path prefix the host sees in `request.url` would break verification. Root-mounted hosts
  (the default) are unaffected.
- **Caveat 2 (encryption is the transport's job, not HMAC's):** HMAC authenticates and
  integrity-binds every request but does not encrypt it, so confidentiality of the service token and
  broker credentials in a config-push body rides on the transport. Two mechanisms keep those secrets
  off an eavesdroppable link:
  - The host serves **HTTPS** when `TLS_CERT_PATH` + `TLS_KEY_PATH` are set (`buildHttpsOptions` in
    `plugin-host/app/src/index.ts`; optional `TLS_CA_PATH` for a chain; both cert and key required or
    the host refuses to start), encrypting the GZAC→host channel end-to-end.
  - Host registration **refuses a non-null `eventBrokerAmqpUrl` unless the host base URL is a
    confidential transport** — HTTPS, or a loopback address (`localhost`/`127.0.0.1`/`::1`) for local
    development (`ExternalPluginHostService.isSecureTransport`). Registration is the single gate
    because the base URL is immutable afterwards, so no later push can reach an insecure host with
    broker credentials.

  Hosts without a broker (actions only) may still run over plain HTTP — e.g. behind a TLS-terminating
  reverse proxy. Replay and forgery are closed by the HMAC scheme; eavesdropping is closed by running
  the broker-carrying channel over TLS.

## 4. Permission UX ✅

Components: `plugin-management/.../{plugin-external-permissions, plugin-add-modal,
plugin-external-edit-modal, plugin-external-configure}`. Endpoint descriptions are localised via
`POST /api/management/v1/external-plugin/endpoint-descriptions` (aggregated from every module's
`EndpointDescriptionProvider`; glob and `{param}` matching, `en`/`nl` with `en` fallback).

The Permissions step shows two read-only sections under a single acknowledgement checkbox:

- **API endpoints** — every entry from `manifest.permissions.endpoints` with method, pattern, and
  localised description.
- **Events** — every CloudEvent type from `manifest.eventSubscriptions` that the plugin will
  receive at `handle_event`.

Both are equally a permission decision: granting endpoints lets the plugin act on the user's data;
granting events lets it observe domain activity. The single acknowledgement covers both — both are
all-or-nothing, the backend rejects activation unless every declared item in both lists is
granted.

- **Add / activate**: select → configure (properties or config iframe) → **Permissions**. Save →
  `POST .../configuration` `{definitionId, title, properties, grantedEndpoints, grantedEvents}`.
- **Edit**: same component with `[readonlyMode]="true"`; the UI update sends `{title, properties}`
  only. Granted **events** are truly immutable post-activation (service-layer `update()` has no
  `grantedEvents` parameter). Granted **endpoints** are immutable *in the UI*, but the backend
  `update()` will replace them if a non-null `grantedEndpoints` is supplied (§3.1) — the
  immutability of endpoint grants is a UI guarantee, not a service-layer one.

## 5. Data model ✅

Tables (host secret and config properties stored encrypted via the existing `EncryptionService`).
DDL lives in the **core** module's changelog, not the external-plugin module's own resources:
`backend/core/src/main/resources/config/liquibase/13-28-0/20260504-external-plugin.xml`.

- `external_plugin_host` — `base_url`, encrypted `secret`, `status`, health/failure counters,
  **plus** `gzac_callback_base_url`, `event_broker_amqp_url`, `event_broker_exchange` (all
  populated from the add-host UI; the two broker columns nullable for events-off / use-default-exchange),
  **plus** `event_queue_mode` (`LIVE`/`DURABLE`, default `LIVE`, added in
  `20260617-external-plugin-event-queue.xml`) and `event_queue_ttl_ms` (nullable bigint; required
  when mode is `DURABLE`, ignored when `LIVE`).
- `external_plugin_definition` — `UNIQUE(plugin_id, version)`, `config_schema`, `manifest_json`,
  `host_id`, `base_url`, `status`, plus `name`, `description`, `provider`, `min_gzac_version` /
  `max_gzac_version` (populated at discovery from the manifest's `compatibility` block, compared
  against the running GZAC version to surface a non-blocking compatibility warning — §11),
  `consecutive_misses`. The
  manifest's declared `eventSubscriptions` live here (inside
  `manifest_json`), discovered from the host — but the authoritative subscription list for any
  given activated configuration is `external_plugin_granted_event` (next paragraph), not the
  manifest copy.
- `external_plugin_configuration` — `definition_id`, `title`, `properties` (encrypted on schema
  `x-secret` fields), `created_at`.
- `external_plugin_granted_event` — `configuration_id`, `event_type`, `granted_at`;
  `UNIQUE(configuration_id, event_type)`. Pushed to the host on every config push as the actual
  subscription set. A later manifest update that adds a new event type cannot widen this set — the
  row only changes when the admin re-grants.
- `external_plugin_granted_endpoint` — `configuration_id`, `http_method`, `endpoint_pattern`,
  `granted_at`; `UNIQUE(configuration_id, http_method, endpoint_pattern)`.
- Each grant table enforces a DB unique constraint on its `(configuration_id, …)` natural key, so
  duplicate grant rows are structurally impossible. The replace-on-write `update()` flow deletes a
  configuration's endpoint grants and flushes that delete before re-inserting, so a replacement set
  that overlaps the previous grants stays within the constraint.
- `external_plugin_*` columns on `process_link` (`external_plugin_config_id`,
  `external_plugin_action_key`, `external_plugin_version`, `external_plugin_action_properties`) for
  the `SERVICE_TASK_START` action link.

Events add **no new table**: subscriptions come from `manifest_json`, the broker connection
details come from the host row, and at push time they are pushed transiently to the host (held
only in the host's in-memory registry until the host stores them in its own PostgreSQL).

## 6. Adding a host & host-defaults endpoint ✅

`GET /api/management/v1/external-plugin/host-defaults` (`ExternalPluginManagementResource`)
returns pre-fills the add-host UI uses to populate the new-host form:

```json
{
  "gzacCallbackBaseUrl": "http://localhost:8080",
  "eventBrokerAmqpUrl": "amqp://guest:guest@localhost:5672",
  "eventBrokerExchange": "valtimo-events",
  "defaultEventQueueTtlMs": 259200000,
  "minEventQueueTtlMs": 3600000,
  "maxEventQueueTtlMs": 2592000000
}
```

The operator edits whatever does not match the host's network. URL fields exposed:
`gzacCallbackBaseUrl` is required; `eventBrokerAmqpUrl` and `eventBrokerExchange` are optional.
Leaving the broker URL blank disables events for every configuration under this host. The
`*EventQueueTtlMs` triplet drives the durable-mode TTL input in the UI (default 72h, range 1h–30d);
the constants live on `ExternalPluginHostService` (`DEFAULT_/MIN_/MAX_EVENT_QUEUE_TTL_MS`).

`ExternalPluginHostService.register()` trims trailing `/` on the URLs, encrypts the secret,
blanks become `null`. When a broker URL is supplied it additionally requires the host base URL to be
a confidential transport (HTTPS, or a loopback address for local development) and rejects the
registration otherwise, so the broker AMQP URL and credentials are never pushed over plaintext
(§3.9).

The same service exposes a **narrowly-scoped update path** for the event-queue mode/TTL only:
`PATCH /api/management/v1/external-plugin/host/{hostId}/event-queue` with
`{eventQueueMode, eventQueueTtlMs}`. `baseUrl`, `secret`, `eventBrokerAmqpUrl`, and
`eventBrokerExchange` remain immutable — the security check that pins broker credentials to a
confidential `baseUrl` only needs to run at registration. After the PATCH, the resource triggers
`discoveryService.discoverAll()` so the host's `EventConsumerManager.sync()` swaps the queue
immediately instead of waiting for the next polling tick.

## 7. Plugin host 🟡 (`plugin-host/app/`, Node + Fastify + Extism)

Routes: `GET /health`; `*/api/host/plugins[...]` (HMAC-signed §3.9; POST upload, GET list,
DELETE); `POST|PUT|DELETE|GET /api/host/configurations/:configId` (HMAC-signed §3.9; push body
carries `pluginId, pluginVersion, properties, serviceToken, gzacBaseUrl, eventSubscriptions` and
optionally `eventBroker` — only `serviceToken`/`gzacBaseUrl` are actually validated, `pluginId`/
`pluginVersion` are not null-checked); `POST /plugins/:id/:version/actions/:key`
(HMAC-signed §3.9 — **no GET variant**); public `GET …/plugin-manifest`, `…/logo`,
`…/bundles/**`. Multi-version load keyed `pluginId@version`. The only registered host function is
`gzac_api`.

Configs are **persisted to PostgreSQL**; `ConfigRegistry` is a thin pass-through over
`ConfigRepository` — every read/write hits the DB, there is **no separate in-memory cache** despite
the name. The plugin manager serialises calls per plugin (a `lock` promise
chain to avoid Extism reentrancy), sets `prefetch` on the broker channel, and hot-reloads a plugin
(unload + reload) when a newer upload of the same `pluginId@version` arrives.

- **Action HTTP body** (GZAC→host): `{configurationId, processInstanceId, activityId, documentId?,
  properties}` — note it does **not** carry `actionKey` (URL param) or `configuration` (looked up
  host-side from the registry). The host assembles the **Wasm input** `{actionKey, configurationId,
  configuration, processInstanceId, documentId, activityId, properties}`; output `{status,
  variables}` (plus `{errorCode, errorMessage}` on failure, surfaced to the process as a BPMN
  error).
- **Plugins run under Extism with `runInWorker: true`** so async host functions (`gzac_api`) can
  suspend the Wasm call until the host's fetch resolves. **This requires Node ≥ 22** (older Node
  fails to spawn the worker with `invalid execArgv flags: --disable-warning`).
- **`DELETE /api/host/plugins/:pluginId/:version`** refuses removal with HTTP 409 if any active
  configurations on the host reference the plugin version
  (`configRegistry.listByPlugin(pluginId, version)`), returning the offending `configurationIds`.

Environment (`models/app-config.ts`): `ADMIN_TOKEN` (required — the shared secret used as the
HMAC key for every GZAC→host route, §3.9), `PORT` (8090),
`PLUGIN_STORAGE_DIR` (`./plugins`), `LOG_LEVEL` (info), `HOST_ID` (defaults to the OS hostname;
see §8.4), plus `DB_HOST` / `DB_PORT` (defaults to **5434**, not the standard 5432) / `DB_NAME` /
`DB_USER` / `DB_PASSWORD` for the host's PostgreSQL, and optional `TLS_CERT_PATH` / `TLS_KEY_PATH`
(set together to serve HTTPS — §3.9) plus `TLS_CA_PATH` for a certificate chain. **No broker
variables** — the host never configures a broker itself.

Gaps to close for production: no `log` / `http_request` / `kv` host functions or capability
allowlist; no HTMX `render_page` / `handle_request`.

## 8. Event subscription & delivery ✅

End-to-end, an event the core app emits is delivered to every subscribed plugin configuration's
`handle_event`, which may call back into the core app.

```
GZAC domain event
  └─ OutboxService (same TX)  → outbox_message
       └─ PollingPublisherJob (~3s) → RabbitMessagePublisher.convertAndSend("valtimo-events", "", cloudEvent)
            └─ exchange valtimo-events (fanout, durable)
                 ├─ valtimo-audit  (core app's own consumer)
                 ├─ valtimo-inbox  (core app's own consumer)
                 └─ valtimo-external-plugins.<exchange>.<HOST_ID>   ← each plugin host's own queue
                      └─ EventConsumerManager → handle_event(EventInput) → onEvent(...)
                           └─ optional gzac_api callback (service token + allowlist enforced)
```

### 8.1 Publish (core app)

Domain events extend `com.ritense.outbox.domain.BaseEvent` and are serialized as CloudEvents v1.0
JSON by `CloudEventFactory`. `RabbitMessagePublisher` sends them with
`convertAndSend(exchange, routingKey, body)` where `exchange = valtimo-events` (from
`valtimo.outbox.publisher.rabbitmq.exchange`) and `routingKey` is empty. `valtimo-events` is a
**fanout, durable** exchange declared in `backend/app/gzac/imports/gzac-rabbitmq/definitions.json`
(also bound to the core app's `valtimo-audit` and `valtimo-inbox` queues).

### 8.2 Per-host broker and granted subscriptions, pushed by GZAC

The plugin host is **not** configured with a broker URL via env variables. It learns each
configuration's broker from the GZAC push, so one host can serve many GZAC instances and many
hosts can serve one instance.

`ExternalPluginConfigurationService.pushToHost(config, definition, host)` reads:
- The broker fields off the host row, with `host.eventBrokerExchange` falling back to the outbox
  exchange when null and `exchangeType` hardcoded `fanout`. `eventBrokerAmqpUrl` being null
  causes the entire `eventBroker` block to be omitted from the push body — actions still work,
  events don't.
- The granted event types off `external_plugin_granted_event` for this configuration. These are
  sent as the push body's `eventSubscriptions` array — the host's authoritative subscription set
  for this configuration, narrower-or-equal to the manifest's declared list.

Push body shape (relevant fields):

```json
{
  "pluginId": "case-summary",
  "pluginVersion": "0.1.0",
  "properties": { },
  "serviceToken": "eyJ…",
  "gzacBaseUrl": "http://gzac:8080",
  "eventSubscriptions": ["com.ritense.valtimo.document.created", "com.ritense.valtimo.task.completed"],
  "eventBroker": {
    "amqpUrl": "amqp://…",
    "exchange": "valtimo-events",
    "exchangeType": "fanout",
    "queueMode": "live",
    "queueTtlMs": null
  }
}
```

`queueMode` is `"live"` or `"durable"` (lowercased on the wire — the host's `normalizeEventBroker`
defaults unknown/absent values to `"live"`, so older GZACs that don't push it stay compatible).
`queueTtlMs` is present only when `queueMode === "durable"` and is clamped defensively to the
1h–30d window even though GZAC validates the same bounds at registration / PATCH time.

### 8.3 Consume (host, `rabbitmq/event-consumer.ts`)

`EventConsumerManager` keeps one `BrokerConsumer` per **distinct broker**
(`brokerKey = amqpUrl + exchange + exchangeType`). Note: `queueMode`/`queueTtlMs` are intentionally
**not** in the broker key — they are queue-level concerns, not connection-level, so two
configurations on the same broker still share a single connection while the queue arguments come
from the host-wide mode. After any configuration mutation the route calls `sync()` (serialised via
a promise chain): it opens consumers for newly referenced brokers and closes consumers no
configuration references any more. A `BrokerConsumer`:
- `assertExchange(exchange, exchangeType, { durable: true })`,
- `assertQueue("valtimo-external-plugins.<exchange>.<HOST_ID>.<queueMode>", …)` with arguments
  switched per mode:
  - **`live`** (default): `{ durable: false, autoDelete: true }` — queue evaporates when the host
    disconnects; events while the host is fully down are lost (live-subscription semantics).
  - **`durable`**: `{ durable: true, autoDelete: false, arguments: { "x-expires": queueTtlMs } }` —
    queue survives host restarts; `x-expires` deletes the queue after `queueTtlMs` of no-consumer
    inactivity, so a host that vanishes permanently doesn't accumulate events forever.

  The mode suffix in the queue name means flipping `queueMode` produces a different queue and so
  never collides with the previous queue's `assertQueue` arguments — the old `.live` queue
  auto-deletes on disconnect; an orphan `.durable` queue lingers until its `x-expires` fires or an
  operator deletes it from the management UI.
- `bindQueue(queue, exchange, "")` (fanout ignores the routing key),
- `consume(..., { noAck: false })` — ack on success; a malformed message is `nack`-dropped (not
  requeued) to avoid a poison loop. There is **no DLQ** today; expired or dropped messages are
  silently lost.

Restart behaviour: configs are persisted in the host's PostgreSQL (`plugin_configurations` table).
On boot the host calls `eventConsumerManager.sync()` which re-opens consumers for every config
that still carries an `eventBroker.amqpUrl`. Expect a `"Broker consumer started"` log line at
startup if any persisted configs reference a broker, even before GZAC sends a fresh push.

**Self-healing reconnect.** Once `BrokerConsumer.start()` has succeeded the consumer owns its own
reconnect loop: an unexpected `close` on the AMQP connection schedules a backed-off reconnect
(`1s, 2s, 4s, …`, capped at 30s with 50–100 % jitter) and the consumer stays in the manager's map
across the gap, so delivery resumes without a configuration push or host restart. A successful
reconnect resets the backoff and re-asserts the exchange, queue, binding, and `consume`. The loop
terminates only on intentional close — when the manager's `sync()` removes a broker that is no
longer referenced by any configuration, or when the host shuts down. The initial `start()` call
keeps its strict contract: if connecting to a broker that has *never* worked fails, the consumer is
left out of the map and the next `sync()` retries — only post-success drops are self-healed. The
auto-delete live-subscription queue (§8.4) is re-created on every reconnect, so events published
during a disconnected window are still not retained for the host.

### 8.4 Dispatch & multi-host topologies

For each consumed CloudEvent the manager iterates the config registry and invokes `handle_event`
for every configuration that (a) carries the **same broker key** as the consuming connection (so
instance A's events never reach instance B's configs) **and** (b) whose stored
`eventSubscriptions` (the granted set pushed by GZAC, persisted in the host's
`plugin_configurations.event_subscriptions` column) contains the CloudEvent `type`.

The manifest's declared `eventSubscriptions` is **not consulted at dispatch time** — only the
granted set is. This is the security gate that prevents a plugin author from silently expanding
the dispatched event set: publishing a new plugin version that adds an event type to the manifest
does not start delivering that type until an admin explicitly re-grants. The same configuration's
running v2 keeps receiving only what was originally accepted.

The Wasm `EventInput` is the flattened event (`type, id, source, time, userId, roles, resultType,
resultId, result`) plus the configuration's `properties`. `serviceToken` and `gzacBaseUrl` ride in
the Extism per-call `hostContext`, so an event handler's `gzac_api` callback is authenticated and
allowlist-enforced exactly like an action's.

Multi-host topologies:
- *Different* hosts on one GZAC instance have distinct queues → **every host receives a copy** of
  each event.
- *Replicas of the same host* (shared `HOST_ID`) bind the **same** queue and become competing
  consumers → each event is handled by **exactly one** replica.
- *One host serving multiple GZAC instances*: each instance has its own broker, so the host opens
  a separate `BrokerConsumer` per broker. Dispatch only fires configurations whose pushed broker
  key matches the consuming connection.
- Durability trade-off (configurable per host): `live` mode preserves today's no-overhead
  semantics — events published while the host is fully down are not retained. `durable` mode
  retains buffered events up to `queueTtlMs` since the last consumer disconnected, at the cost of
  a queue that has to be cleaned up if a host is deprovisioned and its `HOST_ID` never returns
  (the TTL is the automatic cleanup). Plugin handlers must already be idempotent because gzac's
  outbox is at-least-once, so durable replay does not change handler-correctness requirements.

### 8.5 SDK & declaration

A plugin declares the CloudEvent types it cares about in `manifest.json`:

```json
"eventSubscriptions": ["com.ritense.valtimo.document.created", "com.ritense.valtimo.task.completed"]
```

and registers a handler with `onEvent` (`plugin-sdk/src/events.ts`); the SDK runtime
(`plugin-sdk/src/runtime.ts`) exports `handle_event`, settling async handlers synchronously under
QuickJS and reporting `{status: "completed" | "ignored" | "error"}`. Multiple handlers may
register; all run per event.

## 9. SDK & developer experience ✅

A plugin author writes `src/plugin.ts`: import `{action, onEvent, config, gzacApi, log}` from
`@valtimo/plugin-sdk`; `action("key", (input) => ({status, variables}))`; `onEvent((event) => …)`;
read config via synchronous `config.get()`; call `gzacApi.{get,post,put,delete}()` (synchronous
from the plugin's view — the host suspends the call). Build:
`valtimo-plugin-build` (esbuild → `extism-js`) then `valtimo-plugin-pack` (zip of `manifest.json`
+ `plugin.wasm` + `frontend/` + optional `logo.{svg,png,jpg,jpeg}`).

DX done: the build auto-generates the Wasm interface (`handle_action` + `handle_event` exports +
`gzac_api` import) so authors write only `src/plugin.ts`; the runtime settles returned promises
and never serialises a pending `Promise`; the pack copies `manifest.json` verbatim so
`eventSubscriptions`, `permissions`, and `translations` carry through.

`PluginManifest` is defined once in `@valtimo/plugin-sdk/src/models/types.ts`; the host app's
`models/plugin-manifest.ts` re-exports from the SDK so there is a single source of truth. The
manifest has **no top-level `name`/`description`** — those live per-locale under `translations`
(§10). The type encodes this: `translations` is required and each bucket is a `PluginTranslations`
(`{ name: string; description: string; [key: string]: string }`).

**Manifest validation, defined once (`@valtimo/plugin-sdk/manifest-validation`).**
`validatePluginManifest(manifest)` lives in its own dependency-free SDK module exposed via the
`./manifest-validation` subpath export, so it can be consumed without pulling in the plugin-author
runtime. It is the single rule set enforced at **both** gates, each importing it via the same
`@valtimo/plugin-sdk/manifest-validation` subpath: the pack tool (`bin/valtimo-plugin-pack.mjs`,
build-time, self-references the package's own export) and the plugin host's upload route
(`routes/host-management.ts`, runtime, returns HTTP 400 `{error, details[]}` on failure). It
requires a non-empty `pluginId`/`version`, a non-empty `translations` object, and a non-empty
`name` **and** `description` string in **every** declared locale bucket.

Frontend SDK (`@valtimo/plugin-sdk/frontend`):
- `ValtimoPluginSDK` running inside the iframe communicates with the Angular parent via
  postMessage (`init`, `save`, `prefillConfiguration`, `ready`, `configurationChanged`, etc.).
- `sdk.t(key, fallback?)` returns the translation for the current locale (`en` fallback, then
  raw key). Translations come from `manifest.translations[locale]`, fetched on construction from
  the host's `/plugins/:id/:version/plugin-manifest` route.
- `sdk.ready()` resolves once **both** the manifest fetch completes **and** the parent's `init`
  message has arrived (or 2 s timeout); mount React inside `sdk.ready().then(...)` so the very
  first render uses the correct locale instead of flashing `en`.

## 10. Plugin assets — logo and translations ✅

**Logo.** Convention: drop `logo.svg`, `logo.png`, `logo.jpg`, or `logo.jpeg` next to
`manifest.json`. The pack tool detects the first match, includes the file at the zip root, and
writes `"logo": "logo.svg"` into the manifest *inside the zip* (the source `manifest.json` on
disk is untouched). The host serves it at `GET /plugins/:id/:version/logo` with the right
Content-Type. `DefinitionResponse.logoUrl` exposes the absolute URL to the management UI, which
renders it (a) in the "Configure plugin" tile (`plugin-add-select.component.html`) and (b) in the
process-link plugin picker (`select-plugin-configuration.component.ts`) — the same surfaces that
already render `pluginLogoBase64` for embedded plugins.

**Translations.** Manifest's top-level `translations: { "en": {...}, "nl": {...} }` block ships
in the package and is exposed to the iframe via the same plugin-manifest endpoint. The frontend
SDK fetches it on construction. `sdk.t(key)` reads the active locale's bucket; the active locale
comes from the Angular `TranslateService.currentLang` and is passed by
`ExternalPluginIframeComponent.onIframeLoad()` in the `init` postMessage payload. Falls back to
`defaultLang`, then `en`. Sample plugin (`case-summary`) has both `en` and `nl` buckets covering
every label, placeholder, and helper text; React components mount inside `sdk.ready().then(...)`
so users never see raw translation keys flash on screen.

**Name & description are translations ✅.** The plugin's display **name** and **description** are
`name`/`description` keys inside **each** locale bucket — there are no top-level `name`/
`description` fields. Every declared locale must carry both, enforced once by `validatePluginManifest`
at pack-time and upload-time (§9).

- *Backend.* `ExternalPluginDiscoveryService.localizedManifestValue()` derives the denormalised
  `external_plugin_definition.name`/`description` columns from the `en` bucket (fallback: first
  declared locale). `DefinitionResponse` still exposes those columns **and** the full `manifest`
  (with `translations`), so the frontend can localise.
- *Frontend, single source of truth.* `@valtimo/plugin` exports `getExternalPluginName`,
  `getExternalPluginDescription`, and `getExternalPluginDisplayName` (name + `(version)`). They read
  `manifest.translations[lang]`, fall back to `en`, then the denormalised `definition.name`/
  `pluginId`. Every surface that renders an external plugin's name/description uses them and
  **reacts to language change** via `TranslateService.stream('key')` / `onLangChange`: the
  "Configure plugin" tile (`plugin-add-select`), the configurations list `pluginName` column
  (`plugin-management`), the process-link configuration picker (`select-plugin-configuration`), and
  the external edit-modal header (`plugin-external-edit-modal`). Switching the Angular UI between
  Dutch and English re-renders these labels live.

**CSP.** The main app's CSP `<meta>` tag is augmented at boot
(`projects/valtimo/security/.../initialize-csp.ts`) with the discovered host origins on both
`frame-src` (iframe loading) **and** `img-src` (logo loading). The bootstrap fetches
`/api/management/v1/external-plugin/host` and passes the origins into the initializer; without
this, `<img src="http://plugin-host:8090/.../logo">` is blocked by `img-src 'self' data:`.

## 11. Multi-version support & compatibility 🟡 (coexistence ✅, compatibility check ✅, in-place upgrade ⛔)

**Why coexistence matters.** Once a case definition becomes *final*, its BPMN — including any
service tasks bound to an external-plugin action — is immutable. A process link cannot then be
edited, and therefore cannot be moved to a newer version of the same plugin. New work happens on
a new case definition, which is free to bind to a newer plugin version. This means **multiple
versions of the same plugin must run side-by-side indefinitely**: there is no path of
"deprecating" an old version while final case definitions still reference it.

**What works.**
- `external_plugin_definition` has `UNIQUE(plugin_id, version)` so v1 and v2 of the same plugin
  coexist as separate rows.
- The host loads each `(pluginId, version)` as a distinct Wasm module.
- A `Configuration` references one specific `definition_id` → pinned to one version.
- A `ProcessLink` carries an explicit `pluginVersion` column → pinned to one version transitively.

**Operator flow for adding a new version (no upgrade required).**
1. Plugin author publishes v2 to the host alongside v1.
2. GZAC discovers both versions and lists them as separate entries in the "Configure plugin"
   modal.
3. Admin activates a **new v2 configuration** alongside any v1 configurations that are still in
   use.
4. New BPMNs / case definitions bind their service tasks to the v2 configuration; existing final
   case definitions continue to reference their v1 configuration.

**✅ Version visibility in the UI.** The version appears in brackets after the localised plugin
name (`Name (X.Y.Z)`) wherever that name is rendered, via `getExternalPluginDisplayName` (§10), so
coexisting versions stay distinguishable:
- The "Configure plugin" modal tile (`plugin-add-select`) — `Name (X.Y.Z)` plus the description.
- The configurations overview list `pluginName` column (`plugin-management`).
- The process-link configuration picker (`select-plugin-configuration`) — so the BPMN author knows
  which version they're binding to.
- The configuration edit-modal header (`plugin-external-edit-modal`) — `{configTitle} - Name (X.Y.Z)`.

All four recompute on language change (the version suffix rides along with the localised name).

**Compatibility check ✅.** A plugin declares the GZAC version range it targets in its manifest:

```json
"compatibility": { "minGzacVersion": "12.0.0", "maxGzacVersion": "12.1.0" }
```

Both bounds are optional and inclusive. GZAC compares the range against its own running version and
**warns** on a mismatch; it never hard-blocks activation. One comparator backs two entry points:

- *Comparator* (`compatibility/GzacCompatibilityChecker.kt`) parses both bounds and the current
  version as semver (`org.semver4j.Semver`) and returns
  `CompatibilityResult(compatible, currentGzacVersion, minGzacVersion, maxGzacVersion, status)` with
  `status ∈ {COMPATIBLE, BELOW_MINIMUM, ABOVE_MAXIMUM, CURRENT_VERSION_UNKNOWN}`. Lenient by design:
  an absent or unparseable bound is not enforced, and an undeterminable current version yields
  `compatible = true` (`CURRENT_VERSION_UNKNOWN`) so noisy version metadata never raises a false
  warning.
- *Running version* (`compatibility/DefaultGzacVersionProvider.kt`, behind the `GzacVersionProvider`
  fun-interface) resolves in precedence order: (1) the `valtimo.external-plugin.gzac-version`
  property (operator override, useful in tests or when the build metadata is absent/wrong), (2) the
  Valtimo library version — the `Implementation-Version` stamped on every Valtimo module's jar
  manifest (`backend/build.gradle` sets it to `projectVersion` for all subprojects). This is the
  canonical source because a plugin's `compatibility` range targets the Valtimo *platform*, not the
  wrapping application: it is the same value the UI sidebar shows for the backend (read by
  `com.ritense.valtimo.web.rest.VersionResource` off a core-module class) and stays correct even when
  Valtimo is embedded in a downstream app whose own build version differs. The autoconfiguration
  reads it from `DefaultGzacVersionProvider`'s own package, which carries that manifest version.
  `null` when neither resolves (e.g. a dev run from class directories with no jar manifest), which the
  comparator treats as "cannot judge".

Two places run it:

- **Listing / detail** — `ExternalPluginManagementResource.toDefinitionResponse()` checks each
  definition's stored `min_gzac_version` / `max_gzac_version` columns (populated at discovery from
  the manifest) and folds the outcome into `DefinitionResponse` (`minGzacVersion`, `maxGzacVersion`,
  `currentGzacVersion`, `compatible`). Informational only — an incompatible definition still lists
  and still activates.
- **Upload** — `POST …/host/{hostId}/upload` takes a `force` flag (default `false`). With
  `force=false`, `compatibility/PluginPackageInspector.kt` peeks the `compatibility` block straight
  from the uploaded `.zip`'s `manifest.json` (the definition row does not exist yet — discovery runs
  only after a successful upload), and an incompatible plugin is refused with **`409 Conflict`**
  carrying `{incompatible, compatible, currentGzacVersion, minGzacVersion, maxGzacVersion}`; the host
  is never contacted and discovery never runs. With `force=true` the upload proceeds regardless. The
  inspector is resilient — a missing manifest, missing `compatibility` block, or any parse failure
  yields no gate, and the manifest read is capped at 1 MB.

The frontend surfaces incompatibility as a **non-blocking** warning, localised via
`pluginManagement.compatibility.*` (`en`/`nl`) through one message builder
(`plugin-management/.../utils/external-plugin-compatibility.util.ts`), gated solely on
`compatible === false` (`isExternalPluginDefinitionIncompatible()`):
- the configurations table (`plugin-management.component`) shows an "Incompatible" tag with an
  info-tooltip on each external row whose definition is incompatible;
- the configure step (`plugin-add-modal.component`) shows `incompatibleWarning$` for an incompatible
  selection, recomputed on language change;
- the upload modal (`plugin-upload-modal.component`) turns the `409` (kept off the global error
  toast by the `X-Skip-Interceptor: 409` request header) into an "Upload an incompatible plugin?"
  confirmation that re-issues the upload with `force=true`.

**⛔ Other gaps.** Schema migration for an in-place v1 → v2 configuration "upgrade" is not
implemented and arguably unnecessary given the side-by-side model. Permission-diff prompts and a
`LATEST/STABLE/DEPRECATED` channel status are open. The compatibility range is a warning rather than
an activation gate — only upload is a confirm-gate; an admin can still activate a configuration for
an incompatible definition.

## 12. Deletion semantics — strict, never forced ✅

Deletion of a host or a plugin configuration is **never allowed** while any process link in the
system references that configuration — even when the case definition that owns the BPMN is final
and the link is therefore frozen. The same guard covers both **external** plugin configurations /
hosts and **embedded** (`com.ritense.plugin`) configurations.

Rationale: a forced cascade would silently break a final case definition's runtime behaviour. The
configuration is immutable for the same reason the BPMN that references it is immutable. The user
experience is to surface what depends on the resource and explain that deletion is unavailable —
there is no force override on any path.

| Entity | Blocked when… | Surface |
|--------|---------------|---------|
| **ProcessLink** | never (BPMN authoring is the source of truth — the case definition is the gate) | — |
| **Configuration** (external) | any `ProcessLink` references it | Server-side guard in `ExternalPluginConfigurationService.delete` throws `ExternalPluginConfigurationInUseException` (HTTP 409, `usages` payload). UI runs the usage pre-check and shows the read-only `PluginUsageModalComponent` listing the referencing activities. No override. |
| **Configuration** (embedded) | any *fixed* `PluginProcessLink` references it | Server-side guard in `PluginService.deletePluginConfiguration` throws `PluginConfigurationInUseException` (HTTP 409, `usages` payload). Same UI flow and modal. |
| **Definition** | any `Configuration` exists for it | Not directly user-deletable; cleared by the discovery cycle when the upstream host no longer lists the version **and** no configurations remain. |
| **Host** | any `Configuration` under any definition on this host has at least one `ProcessLink` referencing it | Server-side guard in `ExternalPluginHostService.delete` throws `ExternalPluginHostInUseException` (HTTP 409, `usages` payload). Host delete in the UI shows the same `PluginUsageModalComponent`. Deletion of an entire host with active configurations remains blocked: removing the host would orphan service tokens, push paths, and broker bindings for live configurations. |
| **Plugin on host** (host-side route) ✅ | active config refers to plugin version | `DELETE /api/host/plugins/:id/:version` returns HTTP 409 with `configurationIds`. |

A configuration that *has* been activated but has no process links yet **can** be deleted (it is
not yet load-bearing). A host without any configurations can be deleted. Discovery cleanup
continues to mark missing definitions `UNAVAILABLE` after N consecutive misses
(`failure-threshold`, default 3) rather than deleting them.

**12.1 Shared usage infrastructure (core plugin module).** The guard reuses one set of types and
one process-definition reader across both plugin systems, all living in the **core** `plugin`
module (`backend/plugin`, which now depends on `:backend:core` for the Operaton lookups). External
code imports them rather than redefining them:

- `web/rest/dto/PluginUsageDto` + `PluginUsageParentType` (`CASE | BUILDING_BLOCK | GLOBAL`) — the
  single DTO shape returned in all four 409 payloads and `/usages` responses. Carries
  `configurationId`, `configurationTitle`, `parentType`, `parentKey`, `parentVersionTag`,
  `processDefinitionId`, `processDefinitionKey`, `processDefinitionName`, `activityId`,
  `activityName`, `processLinkId`.
- `service/ProcessDefinitionUsageMetaResolver` — resolves a process definition's key/name, the
  owning **case definition or building block** (parsed from the Operaton `versionTag` via
  `OperatonProcessDefinition.getBlueprintId()`, widened into `PluginUsageParentType`), and lazily
  the BPMN model so the **activity name** can be looked up. All Operaton/BPMN reads are wrapped in
  `runCatching`, so a missing or unloadable process definition degrades to nullable fields
  (`GLOBAL` + null key/version) — the row still surfaces with `processDefinitionId` and the link id
  for manual investigation.

Two thin usage resolvers sit on top of it:
- `PluginConfigurationUsageResolver` (core) — one `PluginUsageDto` per *fixed* `PluginProcessLink`
  referencing the configuration. **BUILDING_BLOCK references resolve dynamically per
  building-block context and are stored with `plugin_configuration_id = NULL`**, so they are
  correctly excluded by `findByPluginConfigurationId` — only fixed references block deletion of a
  specific configuration.
- `ExternalPluginHostUsageResolver` (external-plugin module) — `findUsagesForConfiguration(id)` and
  `findUsagesForHost(id)` (the host variant fans out over every definition→configuration under the
  host), via `ExternalPluginProcessLinkRepository.findAllByExternalPluginConfigurationIdIn(...)`.

**12.2 Exceptions.** Three `AbstractThrowableProblem`s, all HTTP 409 `application/problem+json`
with `getCause() = null` (so no stack leaks into the body) and a `parameters` map rendered as
top-level keys: `PluginConfigurationInUseException` (core, `configurationId` + `usages`),
`ExternalPluginConfigurationInUseException` (`configurationId` + `usages`), and
`ExternalPluginHostInUseException` (`hostId` + `usages`).

**12.3 Advisory `/usages` endpoints (proactive UI).** Each delete is preceded by a read-only
lookup so the UI can disable / divert the delete control before the user commits, returning the
same `List<PluginUsageDto>` the 409 would carry. All three are `ADMIN`-gated in their respective
`HttpSecurityConfigurer`s:
- `GET /api/v1/plugin/configuration/{id}/usages` (embedded);
- `GET /api/management/v1/external-plugin/configuration/{id}/usages`;
- `GET /api/management/v1/external-plugin/host/{hostId}/usages`.

These are **advisory only** — the server-side guard in the `delete` methods remains authoritative.
An empty list here does not authorise deletion: a process link created between the pre-check and
the delete still surfaces the 409, which the UI also handles.

**12.4 Frontend flow.** `@valtimo/plugin` exports the `ExternalPluginHostUsage` /
`ExternalPluginHostUsageParentType` types (mirroring the DTO) and the
`getHostUsages` / `getConfigurationUsages` service calls (`ExternalPluginService`), with
`PluginManagementService.getConfigurationUsages` for embedded configs. `PluginManagementComponent`
runs one unified `_requestDeleteConfiguration(source, id, title)` entry point for every delete
trigger (row action, external edit modal's `onExternalConfigDeleted`, embedded edit modal's
bubbled `deleteEvent`): it pre-checks usages, then routes to either the read-only in-use modal
(blocked) or a destructive-confirmation modal (clear); the actual delete still catches a 409 and
re-opens the in-use modal to cover the race. The embedded `PluginEditModalComponent` no longer
deletes inline — it emits `deleteEvent` up to the parent so the pre-check + confirmation flow lives
in one place (matching the external edit modal). `PluginUsageModalComponent` is a single read-only,
"Close"-only modal reused for hosts and configurations; the parent supplies the title/description
translation keys. i18n lives under `pluginManagement.{deleteConfigurationModal, hostInUseModal,
configurationInUseModal, usageModal}` in `en.json` / `nl.json`.

## 13. User-token-scoped endpoints (downscoped) ⛔

A plugin's iframe surfaces — case tabs, case widgets, menu pages, task forms — need to call GZAC
endpoints **on behalf of the logged-in user**, not on behalf of the plugin configuration. The
case tab should respect what the user can see; the task form should mutate what the user can
mutate.

**Design (to implement).**

- The same `permissions.endpoints` block in the manifest (§3.8) declares the endpoints the plugin
  may call. The admin's accept-at-activation grant covers both authorities.
- For each iframe load the parent calls a new `POST /api/management/v1/external-plugin/user-token`
  endpoint, which issues a **downscoped** JWT:
  - Bearer authentication: the logged-in user's Keycloak token.
  - Returns a JWT scoped to `(userSub, pluginConfigurationId)`, short TTL (≤15 minutes), keyed on
    the same SHA-256 derived secret as service tokens but with `type=external_plugin_user`.
- A new request filter (`ExternalPluginUserTokenFilter`) accepts the user token, attaches a
  principal that carries **both** the original user identity **and** the bound configuration. PBAC
  runs normally (the user identity controls what's allowed) **and** the endpoint allowlist
  intersection runs (the plugin's granted endpoints restrict further). Net rule: the plugin can
  only do, on behalf of the user, what (a) the user could already do via PBAC **and** (b) the
  admin granted at activation.
- The user token is passed to the iframe via the existing `init` postMessage (replacing the empty
  `accessToken` field, which is currently a placeholder). The frontend SDK exposes
  `sdk.getAccessToken()`; iframes use it as `Authorization: Bearer` on their own fetches.

Service tokens (for action/event callbacks) stay as they are — PBAC-bypassing, allowlist-only —
because plugin code running server-side has no user context. Only iframe-driven calls flow
through the user-token path.

## 14. Not yet implemented ⛔

- Host capabilities + host functions (`http_request`, `kv`, structured `log`) with allowlist
  enforcement.
- HTMX `render_page` / `handle_request`.
- Case tabs / case widgets / menu pages (the iframe surfaces).
- User-token-scoped endpoints (§13) — iframe-driven calls on behalf of the logged-in user with
  PBAC ∩ allowlist intersection.
- Host database for KV / API logs / retention.
- URL-plugin mode.
- DLQ for nacked or expired messages (today `nack(false,false)` drops, `x-expires` deletes the
  queue and its contents).
- Configurable service-token TTL (hardcoded 24h in `ExternalPluginServiceTokenService`).

## 15. Roadmap (priority order)

1. **User-token-scoped endpoints (§13)** — new `POST /user-token` endpoint, user-token filter
   with PBAC ∩ allowlist intersection, frontend wiring in `ExternalPluginIframeComponent.onIframeLoad()`
   to populate `accessToken` from `/user-token`, SDK side already exposes `getAccessToken()`.
2. Capabilities + host functions + allowlist enforcement; surface in the acceptance screen by
   category.
3. HTMX pages, case tabs, case widgets, menu pages.
4. Host database (KV, API logs, retention) + admin log view.
5. Cleanup: align async-vs-sync SDK docs.

## 16. Verification status

- Host `tsc` build and `@valtimo/plugin-sdk` build: clean (including the optional-TLS
  `buildHttpsOptions` wiring in `plugin-host/app/src/index.ts`).
- Backend `:backend:external-plugin:test`: BUILD SUCCESSFUL (allowlist + service-token-filter +
  endpoint-description-provider + host-client-HMAC + host-registration transport-guard +
  compatibility + event-queue mode/TTL tests). The host-client-HMAC suite
  (`client/ExternalPluginHostClientHmacTest`) asserts `pushConfiguration` (body-bound, **including
  the `queueMode`/`queueTtlMs` fields inside the signed `eventBroker` block, with the omit-TTL case
  for `LIVE` mode**), `deleteConfiguration` / `listPlugins` (empty-body), and `uploadPlugin`
  (file-byte-bound) each send `X-Valtimo-Signature` + `X-Valtimo-Timestamp` and **no**
  `Authorization` header, with the signature recomputed from an independent JDK HMAC oracle. The
  host-service suite (`service/ExternalPluginHostServiceTest`) asserts:
  - host registration accepts broker credentials over HTTPS and loopback HTTP, rejects them over
    plaintext HTTP to a remote host, and `isSecureTransport` classifies schemes and loopback hosts;
  - default mode is `LIVE` with null TTL; `DURABLE` without explicit TTL applies the 72h default;
    TTLs outside the 1h–30d window are rejected; `LIVE` with a non-null TTL is rejected;
  - `updateEventQueue` swaps mode + TTL on an existing host, clears the TTL when going back to
    `LIVE`, and throws when the host does not exist.

  The compatibility suite (`compatibility/GzacCompatibilityCheckerTest`,
  `compatibility/DefaultGzacVersionProviderTest`, `compatibility/PluginPackageInspectorTest`,
  `web/rest/ExternalPluginUploadCompatibilityTest`) asserts the semver range comparison
  (below-minimum, above-maximum, open bounds, and unparseable/unknown-version leniency), the
  version-provider precedence (override → Valtimo library manifest version, `null` otherwise), the
  zip manifest peek (root-entry wins, missing/blank/garbage → no gate), and the upload endpoint's
  409-unless-forced gate (an incompatible package is rejected and never forwarded to the host; a
  forced upload, a compatible package, and an undeclared package each go through). The   
  delete-guard suites cover both plugin systems: `service/ExternalPluginHostUsageResolverTest`
  (host- and configuration-scoped usage resolution, parent classification into
  CASE/BUILDING_BLOCK/GLOBAL, activity-name lookup, and graceful degradation when a process
  definition is missing/unloadable), `service/ExternalPluginConfigurationServiceDeleteTest` and
  `service/ExternalPluginHostServiceDeleteTest` (delete proceeds with no usages, throws the
  in-use exception with the populated `usages` payload otherwise), and
  `exception/ExternalPluginHostInUseExceptionTest` (pins the 409 problem-body shape: title,
  `CONFLICT` status, `hostId`, and the `PluginUsageDto` fields).
- Backend `:backend:plugin:test` (`service/PluginServiceTest`): BUILD SUCCESSFUL — embedded
  `deletePluginConfiguration` proceeds when no fixed process link references the configuration,
  throws `PluginConfigurationInUseException` with the `usages` payload when one does, and a
  not-found id is a no-op warning.
- Backend `:backend:app:gzac:compileKotlin`: BUILD SUCCESSFUL.
- Frontend `ng build` (production): clean.
- Sample plugin `build:pack`: clean (Wasm + pack including `logo.svg`, `translations.en/nl`,
  `permissions.endpoints`, and `eventSubscriptions`).
- `backend/app/gzac/src/main/resources/application.yml`: the module requires no additions to it.
- Events, end-to-end against the live `gzac-rabbitmq` broker (sample plugin):
  - host startup re-opens consumers from persisted configs ("Broker consumer started" log on
    boot is expected when a previous push is in the host's PostgreSQL);
  - config push with `eventBroker` opens one broker consumer; the configuration's granted event
    types (`document.viewed`, `task.completed`, `document.created`) invoke `handle_event` →
    `completed`; unsubscribed/ungranted types are not delivered even when they appear in the
    manifest;
  - `document.created` → `gzac_api` issues `POST /api/v1/document/<id>/note` with the
    service-token bearer; the allowlist filter (§3.4) gates the call;
  - multiple hosts per instance: distinct `HOST_ID`s each handle a copy; shared `HOST_ID` is a
    competing-consumer group;
  - deleting the last configuration on a broker tears the consumer down (queue auto-deletes).
- Plugin assets, end-to-end in the browser:
  - `logo.svg` shipped with sample plugin, served at `/plugins/case-summary/0.1.0/logo`, rendered
    in the "Configure plugin" tile and the process-link picker;
  - `manifest.translations.{en,nl}` returned by `/plugin-manifest`;
  - iframe SDK fetches the manifest, applies `TranslateService.currentLang` (passed via the
    parent's `init` postMessage), renders Dutch labels when the Angular UI is Dutch and English
    labels when it is English.

**Not yet verified end-to-end** (confirmed by code reading and clean builds, not by a live run):
- The host has no unit-test harness, so host-side HMAC verification (`createHmacAuthHook` /
  `verifyDeferredHmac`) and the HTTPS listen path (`buildHttpsOptions`, including the both-cert-and-key
  guard and the TLS handshake itself) rest on code reading and a clean `tsc`. A live client↔host run
  over the config-push / management / upload routes — a successful push returning 201, a tampered body
  or stale timestamp returning 401, and a push over an HTTPS listener — is not in the verified record.
- The **synchronous action path** (process service task → `ExternalPluginServiceTaskStartListener`
  → HMAC-signed `invokeAction` → host `preHandler` verify → Wasm `handle_action` → returned
  `variables` applied to the execution, and the 4xx→`BpmnError` path) is not verified end-to-end; the
  HMAC handshake is confirmed coherent by code reading (§3.9), but an end-to-end action run is not in
  the record.
- The **broker self-healing reconnect** (§8.3) — kill the broker container under a connected host,
  observe `"Broker connection closed; scheduling reconnect"` log lines with growing backoff, bring
  the broker back, observe `"Broker consumer reconnected"`, and confirm events published after the
  reconnect are delivered to the plugin — is confirmed by code reading and a clean `tsc`, not by a
  live broker-drop test.
