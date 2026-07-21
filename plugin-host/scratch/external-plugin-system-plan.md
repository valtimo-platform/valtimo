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

> **Host capabilities** are a per-plugin allowlist of host functions a plugin may call. Every
> host function — including `gzac_api` — requires an explicit grant. A plugin declares the
> capabilities it needs in `manifest.permissions.capabilities`; the admin accepts each one
> individually during configuration. The host enforces the allowlist at call time — a plugin
> that was not granted a capability gets an error response, never silent access.
> Four capabilities ship: `gzac_api`, `http_request`, `kv`, and `log`.

| Area | Path | Status |
|------|------|--------|
| Core-app backend module | `backend/external-plugin/` | ✅ |
| Endpoint descriptions (`@EndpointDescription` on every controller method) + contract annotation | `backend/*/.../web/rest/*Resource.{kt,java}`, `com.ritense.valtimo.contract.endpoint.EndpointDescription` | ✅ |
| Plugin host (Node + Fastify + Extism, multi-version) | `plugin-host/app/` | 🟡 |
| Host capabilities (`gzac_api`, `http_request`, `kv`, `log`) — capability allowlist enforcement, new host functions, persistent storage (KV + logs), admin log view | `plugin-host/app/src/host-functions/{gzac-api,http-request,kv,log}.ts`, `plugin-host/app/src/db/{log-repository,kv-repository}.ts`, `plugin-host/app/src/routes/plugin-logs.ts` | ✅ |
| Event consumer (RabbitMQ → `handle_event`) | `plugin-host/app/src/rabbitmq/event-consumer.ts` | ✅ |
| Backend plugin SDK (`@valtimo/plugin-sdk`) — actions, events, requests (`handle_request`), `gzacApi` (+ `asUser`), `httpRequest`, `kv`, `log` (structured), frontend `t()` + parent-proxy data access (`callValtimo`/`getPluginData`) | `plugin-host/plugin-sdk/` | ✅ |
| Shared manifest validation (name/description-in-translations), one rule set for pack + host | `plugin-host/plugin-sdk/src/manifest-validation.ts` (subpath `@valtimo/plugin-sdk/manifest-validation`) | ✅ |
| Sample plugin (action + event handler + logo + i18n) | `plugin-host/sample-plugins/case-summary/` | ✅ |
| Frontend management UI + external models/service/iframe | `frontend/projects/valtimo/{plugin-management,plugin}/` | ✅ |
| Process-link (`SERVICE_TASK_START`) — FIXED + BUILDING_BLOCK references, action result write-back | `backend/external-plugin/.../processlink/` + frontend process-link | ✅ |
| Building-block support (shared `PluginConfigurationReference`, namespaced config mappings, required-plugins endpoint, BB-context admin UX) | `backend/external-plugin/.../processlink/ExternalPluginServiceTaskStartListener.kt` + `backend/building-block/.../service/BuildingBlockPluginDefinitionService.kt` ↔ frontend `process-link/.../{select-plugin-configuration,configure-building-block-plugins}` (§19) | ✅ |
| Case-definition import/export parity (preview contributor, mapper remap hook, dangling repair, `EXTERNAL_PLUGIN` case-tab import) | `backend/external-plugin/.../{preview/ExternalPluginImportPreviewContributor,service/ExternalPluginConfigurationMappingResolver}.kt`, `backend/case/.../service/CaseTabImporter.kt` ↔ frontend `case-management/.../{case-management-upload,case-management-missing-plugin-configurations}` (§20) | ✅ |
| Action result write-back (`action_result_mappings` + `result` output channel), embedded **and** external | `backend/plugin/.../service/PluginActionResultHandler.kt` ↔ frontend `process-link/.../plugin-action-result-mappings` (§21) | ✅ |
| Per-host broker / callback config + defaults endpoint | `backend/external-plugin/.../web/rest/ExternalPluginManagementResource.kt#hostDefaults` | ✅ |
| Per-host durable event queue mode + TTL (live/durable, `x-expires`) + narrow PATCH endpoint | `backend/external-plugin/.../domain/EventQueueMode.kt`, `service/ExternalPluginHostService.updateEventQueue`, `web/rest/...#updateHostEventQueue` ↔ `plugin-host/app/src/rabbitmq/event-consumer.ts` | ✅ |
| Plugin assets (logo + i18n bundle in manifest, served by host) | `plugin-host/plugin-sdk/bin/valtimo-plugin-pack.mjs`, `plugin-host/app/src/routes/plugin-bundles.ts` | ✅ |
| GZAC→host auth on **every** route (HMAC-SHA256, replay-protected, body-bound): actions, config-push, management | `client/ExternalPluginHostClient.kt` + `security/ExternalPluginHmacSigner.kt` ↔ `plugin-host/app/src/security/{hmac,hmac-auth}.ts`, `routes/{plugin-actions,host-configurations,host-management}.ts` | ✅ |
| Transport confidentiality (TLS): host serves HTTPS from `TLS_*`; broker credentials confined to a confidential transport at host registration | `plugin-host/app/src/index.ts` (`buildHttpsOptions`) + `models/app-config.ts` ↔ `service/ExternalPluginHostService.isSecureTransport` | ✅ |
| GZAC compatibility check (semver range vs running version): comparator + version provider + zip manifest peek; non-blocking UI warnings, upload confirm-gate | `backend/external-plugin/.../compatibility/*` + `web/rest/ExternalPluginManagementResource.kt#uploadPlugin` ↔ frontend `plugin-management/.../utils/external-plugin-compatibility.util.ts` | ✅ |
| Strict delete guards (embedded + external), shared usage DTO/resolver + `/usages` endpoints + read-only in-use modal, no force override | core `backend/plugin/.../{web/rest/dto/PluginUsageDto, service/ProcessDefinitionUsageMetaResolver, service/PluginConfigurationUsageResolver, exception/PluginConfigurationInUseException}` + `backend/external-plugin/.../{service/ExternalPluginHostUsageResolver, exception/ExternalPlugin*InUseException}` ↔ frontend `plugin-management/.../plugin-usage-modal/` | ✅ |
| Iframe case-detail tab (`EXTERNAL_PLUGIN` tab type, side table, PBAC content endpoint, bundle-resolver SPI) + admin UX | `backend/case/.../case_/{domain/tab/CaseExternalPluginTab, repository/CaseExternalPluginTabRepository, service/CaseExternalPluginTabService, rest/CaseExternalPluginTabResource, service/ExternalPluginCaseTabResolver}` + `backend/external-plugin/.../service/ExternalPluginCaseTabResolverImpl` ↔ frontend `case/.../case-detail/tab/external-plugin`, `case-management/.../tabs` | ✅ |
| Downscoped user token (PBAC ∩ allowlist), non-management mint endpoint, parent-proxy iframe (opaque origin, no token in iframe) | `backend/external-plugin/.../security/ExternalPluginUserToken{KeyProvider,Authenticator,Filter}, security/ExternalPluginUserPrincipal, service/ExternalPluginUserTokenService, web/rest/ExternalPluginUserTokenResource` ↔ frontend `plugin/.../external-plugin-iframe`, SDK `frontend/plugin-frontend-sdk.ts` (proxy bridge) | ✅ |
| Plugin-served data route (`handle_request` Wasm export + host `POST .../data`) + backend-as-user (`gzacApi.asUser`) | `plugin-host/plugin-sdk/src/{requests.ts,runtime.ts,gzac-api.ts}`, `plugin-host/app/src/{routes/plugin-data.ts,host-functions/gzac-api.ts,plugin-manager.ts#callRequest}` | 🟡 |

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
  applied to `manifest.eventSubscriptions`. `create()` also runs
  `validateGrantedCapabilitiesCoverManifest()` — the same all-or-nothing gate applied to
  `manifest.permissions.capabilities`. All three — `grantedEndpoints`, `grantedEvents`, and
  `grantedCapabilities` — are **required** parameters of `create()`; all three are enforced at
  the service layer, not only in the UX (§4).
- Grants persist to `external_plugin_granted_endpoint` (`configuration_id`, `http_method`,
  `endpoint_pattern`), `external_plugin_granted_event` (`configuration_id`, `event_type`), and
  `external_plugin_granted_capability` (`configuration_id`, `capability`);
  `update()` with non-null `grantedEndpoints` replaces the endpoint grants, null leaves them
  unchanged. `update()` has **no** `grantedEvents` or `grantedCapabilities` parameter — event
  and capability grants cannot change after activation. Granted capabilities are pushed to the
  host alongside the configuration (§18.3) so the host can enforce the allowlist at call time.

**3.2 Token (`service/ExternalPluginServiceTokenService.kt`)** — HS256 JWT:
`sub=external-plugin:{pluginId}:{configId}`, `type=external_plugin_service`, `plugin_config_id`,
`plugin_id`, `plugin_version`, `iss=valtimo-gzac`, `exp=now+ttl`. **No roles.** Signed with
`SHA-256(valtimo.plugin.encryption-secret)` — see `security/ExternalPluginServiceTokenKeyProvider.kt`.
The lifetime `ttl` is the `valtimo.external-plugin.service-token.ttl` property — a Spring duration
(ISO-8601 `PT24H` or the `24h` shorthand), defaulting to 24h — parsed in the autoconfiguration
(`DurationStyle.detectAndParse`) and handed to the service; the service itself falls back to 24h
when constructed without one.

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
sees it. This is the same mechanism for both action handlers and event handlers. `gzac_api` is a
**capability** (§18) — the configuration must be granted `gzac_api` in its capability allowlist
or the host function returns a capability-denied error without making the upstream call.

**3.6 Token lifecycle** — operator-tunable TTL (`valtimo.external-plugin.service-token.ttl`,
default 24h, §3.2), **no separate refresh loop**. Each healthy discovery poll re-pushes every
configuration with a freshly issued token
(`service/ExternalPluginDiscoveryService.syncConfigurations()`), continuously replacing tokens
well inside their lifetime. That poll *is* the refresh mechanism (default 60s,
`valtimo.external-plugin.polling.rate`), so a tuned TTL must stay comfortably above the poll
interval or a token can lapse between pushes.

**3.7 Caveat** — service tokens bypass PBAC, so the allowlist is the entire authorization surface;
an over-broad grant (`/api/v1/**`) gives broad role-free access. Hence the activation-time
acceptance screen (§4) is security-critical.

**3.8 Manifest field naming.** The endpoint allowlist lives at `permissions.endpoints` in the
manifest. The same declaration is the source of truth for both the service-token allowlist (this
section) and the iframe user-token path (§13, ✅) — one block, **two principals** through one
`ExternalPluginEndpointAllowlistFilter` (`ExternalPluginServicePrincipal` and
`ExternalPluginUserPrincipal`). SDK type `Endpoint`, Kotlin DTO `GrantedEndpointEntry`, frontend type
`ExternalPluginEndpoint`. The capability allowlist lives at `permissions.capabilities` in the
manifest — a string array of capability names (`["gzac_api", "http_request", "kv", "log"]`).
SDK type `string[]`, Kotlin `List<String>`, frontend `string[]`. See §18 for the full capability
system.

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
`POST /api/management/v1/external-plugin/endpoint-descriptions`. Each endpoint declares its own
English and Dutch text directly on the controller handler method with an `@EndpointDescription(en,
nl)` annotation (`com.ritense.valtimo.contract.endpoint.EndpointDescription`);
`EndpointDescriptionService` collects every annotation from Spring's `RequestMappingHandlerMapping`
and resolves a queried pattern against them (glob and `{param}` matching, `en`/`nl` with `en`
fallback). A test (`EndpointDescriptionCoverageTest`, `backend/external-plugin`) enforces that
**every** controller endpoint on the classpath — not only management ones — carries both
translations, so the description requirement cannot drift as endpoints are added.

The Permissions step shows three read-only sections under a single acknowledgement checkbox:

- **Host capabilities** — every entry from `manifest.permissions.capabilities` (`gzac_api`,
  `http_request`, `kv`, `log`). Each capability is shown with a localised name and description
  explaining what it grants the plugin (e.g. "GZAC API — Make authenticated calls to the GZAC
  REST API on behalf of the plugin or the logged-in user"). Capabilities are displayed first
  because they represent the broadest grants.
- **API endpoints** — every entry from `manifest.permissions.endpoints` with method, pattern, and
  localised description. Only relevant when `gzac_api` is among the declared capabilities;
  otherwise this section is hidden.
- **Events** — every CloudEvent type from `manifest.eventSubscriptions` that the plugin will
  receive at `handle_event`.

All three are equally a permission decision: granting capabilities lets the plugin call host
functions; granting endpoints scopes *which* GZAC endpoints the `gzac_api` capability can reach;
granting events lets it observe domain activity. The single acknowledgement covers all three — all
are all-or-nothing, the backend rejects activation unless every declared item in all lists is
granted.

- **Add / activate**: select → configure (properties or config iframe) → **Permissions**. Save →
  `POST .../configuration` `{definitionId, title, properties, grantedEndpoints, grantedEvents,
  grantedCapabilities}`.
- **Edit**: same component with `[readonlyMode]="true"`; the UI update sends `{title, properties}`
  only. Granted **events** and **capabilities** are truly immutable post-activation (service-layer
  `update()` has no `grantedEvents` or `grantedCapabilities` parameter). Granted **endpoints** are
  immutable *in the UI*, but the backend `update()` will replace them if a non-null
  `grantedEndpoints` is supplied (§3.1) — the immutability of endpoint grants is a UI guarantee,
  not a service-layer one.

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
- `external_plugin_granted_capability` — `configuration_id`, `capability` (varchar, e.g.
  `gzac_api`, `http_request`, `kv`, `log`), `granted_at`;
  `UNIQUE(configuration_id, capability)`. Pushed to the host on every config push as the
  authoritative capability set (§18.3). A later manifest update that adds a new capability cannot
  widen this set — the admin must re-grant.
- Each grant table enforces a DB unique constraint on its `(configuration_id, …)` natural key, so
  duplicate grant rows are structurally impossible. The replace-on-write `update()` flow deletes a
  configuration's endpoint grants and flushes that delete before re-inserting, so a replacement set
  that overlaps the previous grants stays within the constraint.
- `external_plugin_*` columns on `process_link` for the `SERVICE_TASK_START` action link:
  `external_plugin_config_id` (nullable — null for `BUILDING_BLOCK` references and dangling
  imports), `external_plugin_action_key`, `external_plugin_action_properties`. The plugin identity
  and version live on the **shared** reference columns `reference_type` / `plugin_definition_key`
  (= `pluginId`) / `plugin_definition_version` — the same `PluginConfigurationReference` embeddable
  the embedded `PluginProcessLink` maps; embedded rows keep `plugin_definition_version` null
  (embedded definitions are unversioned). The reference version is design-time metadata only —
  the runtime invocation version always derives from the resolved configuration's definition
  (§19). `action_result_mappings` (json, also shared with the embedded link type) holds the
  action's result write-back rules (§21). The task-form link's version likewise lives on the
  shared reference columns; its own columns are `external_plugin_task_form_{config_id,bundle_key}`.

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
`…/bundles/**`, and **public `POST …/data`** (the `handle_request` RPC route, §13.4/§13.5 —
unauthenticated for this iteration, with CORS `*` + `OPTIONS` preflight; ⚠️ must be capability/auth
gated before production, see §14). Multi-version load keyed `pluginId@version`. The registered
host functions are `gzac_api` (now also able to authenticate as the user, §13.4), `http_request`,
`kv`, and `log` — all four gated by a per-configuration capability allowlist (§18).

Configs are **persisted to PostgreSQL**; `ConfigRegistry` is a thin pass-through over
`ConfigRepository` — every read/write hits the DB, there is **no separate in-memory cache** despite
the name. The plugin manager serialises calls per plugin (a `lock` promise
chain to avoid Extism reentrancy), sets `prefetch` on the broker channel, and hot-reloads a plugin
(unload + reload) when a newer upload of the same `pluginId@version` arrives.

- **Action HTTP body** (GZAC→host): `{configurationId, processInstanceId, activityId, documentId?,
  properties}` — note it does **not** carry `actionKey` (URL param) or `configuration` (looked up
  host-side from the registry). The host assembles the **Wasm input** `{actionKey, configurationId,
  configuration, processInstanceId, documentId, activityId, properties}`; output `{status,
  variables, result?}` (plus `{errorCode, errorMessage}` on failure, surfaced to the process as a
  BPMN error). `variables` is applied as plain Operaton process variables; the optional `result`
  is a separate channel evaluated only by the link's `action_result_mappings` (§21) — the two
  never interfere, and a plugin that returns no `result` simply has nothing to map.
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

Gaps to close for production: no HTMX `render_page`; the `handle_request` `/data` route ships
**public** (no HMAC, no auth) — it must be capability/auth-gated before production (§13.5, §14).
Host capabilities (`gzac_api`, `http_request`, `kv`, `log`) and their persistent storage are
covered in §18.

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

A plugin author writes `src/plugin.ts`: import `{action, onEvent, request, config, gzacApi, log}`
from `@valtimo/plugin-sdk`; `action("key", (input) => ({status, variables}))`;
`onEvent((event) => …)`; `request("/path", (input) => ({status, body}))` for iframe-served JSON
data (§13.4); read config via synchronous `config.get()`; call `gzacApi.{get,post,put,delete}()`
as the **service token**, or `gzacApi.asUser.{…}()` as the **downscoped user token** (§13.4) — both
synchronous from the plugin's view (the host suspends the call). Build: `valtimo-plugin-build`
(esbuild → `extism-js`) then `valtimo-plugin-pack` (zip of `manifest.json` + `plugin.wasm` +
`frontend/` + optional `logo.{svg,png,jpg,jpeg}`).

DX done: the build auto-generates the Wasm interface (`handle_action` + `handle_event` +
`handle_request` exports + `gzac_api` import) so authors write only `src/plugin.ts`; the runtime
settles returned promises and never serialises a pending `Promise`; the pack copies `manifest.json`
verbatim so `eventSubscriptions`, `permissions`, and `translations` carry through, and compiles each
`frontend/*.tsx` referenced by a `frontend/*.html` `<script>` into a `*.bundle.js` (e.g. the
`config`, `process-link-action`, and `case-tab` bundles).

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
- **Parent-proxy data access (§13.2):** `sdk.callValtimo(method, path, body?)` and
  `sdk.getPluginData(path, query?)` return a `Promise<{status, body}>`. Each emits a
  correlation-id-keyed `proxyRequest` to the parent and resolves on the matching `proxyResponse`;
  the iframe holds no token — the parent attaches the downscoped user token (GZAC) or forwards to the
  host `/data` route (plugin data) and returns the **data only**.
- `sdk.t(key, fallback?)` returns the translation for the current locale (`en` fallback, then
  raw key). Translations come from `manifest.translations[locale]`, fetched on construction from
  the host's `/plugins/:id/:version/plugin-manifest` route. The manifest URL is derived from
  `window.location.href` (not `origin`, which serialises to `"null"` at the opaque origin), and the
  manifest route serves `Access-Control-Allow-Origin: *` so the cross-origin fetch from the opaque
  iframe succeeds.
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
(`projects/valtimo/security/.../initialize-csp.ts`) with the discovered host origins on
`frame-src` (iframe loading), `img-src` (logo loading), **and `connect-src`** (the parent-proxy's
cross-origin `POST .../data` fetch, §13.2/§13.5 — without it the call is blocked by
`connect-src 'self' …`, even though the iframe already loaded via `frame-src`). The bootstrap fetches
`/api/management/v1/external-plugin/host` and passes the origins into the initializer before the meta
tag is inserted (the CSP meta is immutable once parsed).

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
- A **`FIXED`** `ProcessLink` references one specific configuration → pinned to one version
  transitively. The link additionally records `pluginId`/version on the shared reference columns
  (`plugin_definition_key` / `plugin_definition_version`) as design-time metadata — the runtime
  call always uses the resolved configuration's definition version, so the two can never diverge
  at invocation time.
- A **`BUILDING_BLOCK`** `ProcessLink` (§19) carries no configuration id — only the
  `pluginId@version` reference. The concrete configuration is supplied per usage context through
  the building block's `pluginConfigurationMappings`, keyed `external-plugin:<pluginId>@<version>`,
  so each case definition using the block pins its own configuration (and thereby version).

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
| **Configuration** (external) | any *fixed* `ProcessLink` (a `BUILDING_BLOCK` reference carries no configuration id and never blocks, §19) **or** any `EXTERNAL_PLUGIN` case tab references it | Server-side guard in `ExternalPluginConfigurationService.delete` throws `ExternalPluginConfigurationInUseException` (HTTP 409, `usages` payload). `ExternalPluginHostUsageResolver` folds in process-link usages **and** case-tab usages (via the case module's `CaseExternalPluginTabService.findUsagesForConfiguration`, §13.1). UI runs the pre-check and shows the read-only `PluginUsageModalComponent`, which renders both row kinds. No override. |
| **Configuration** (embedded) | any *fixed* `PluginProcessLink` references it | Server-side guard in `PluginService.deletePluginConfiguration` throws `PluginConfigurationInUseException` (HTTP 409, `usages` payload). Same UI flow and modal. |
| **Definition** | any `Configuration` exists for it | Not directly user-deletable; cleared by the discovery cycle when the upstream host no longer lists the version **and** no configurations remain. |
| **Host** | any `Configuration` under any definition on this host has at least one *fixed* `ProcessLink` referencing it | Server-side guard in `ExternalPluginHostService.delete` throws `ExternalPluginHostInUseException` (HTTP 409, `usages` payload). Host delete in the UI shows the same `PluginUsageModalComponent`. Deletion of an entire host with active configurations remains blocked: removing the host would orphan service tokens, push paths, and broker bindings for live configurations. |
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
  single DTO shape returned in the 409 payloads and `/usages` responses. Carries
  `configurationId`, `configurationTitle`, `parentType`, `parentKey`, `parentVersionTag`, and — for a
  **process-link** usage — `processDefinitionId`, `processDefinitionKey`, `processDefinitionName`,
  `activityId`, `activityName`, `processLinkId` (all now **nullable**). For an **external-plugin
  case-tab** usage those process fields are null and `tabKey`/`tabName` are populated instead
  (`parentType = CASE`). The frontend `ExternalPluginHostUsage` model and `PluginUsageModalComponent`
  were widened to render either kind.
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

## 13. Iframe surfaces & user-scoped access ✅ (case tab, task form) / 🟡 (POC)

A plugin's iframe surfaces need to call GZAC **on behalf of the logged-in user** (respect what the
user can see/do), and the plugin **backend** may call GZAC either as the user or as the system. Two
iframe surfaces exist — the **case-detail tab** (§13.1) and the **task form** (§13.6); case widgets
and menu pages remain ⛔. The iframe holds **no token** and routes calls through the Angular parent
(the **parent-proxy** model, §13.2) rather than being handed the token via `init`.

### 13.1 Case-tab surface (`EXTERNAL_PLUGIN` tab type) ✅

- New `CaseTabType.EXTERNAL_PLUGIN` (`@JsonValue` → `external_plugin`); 15 chars fit
  `case_tab.type varchar(20)`, **no DDL change** to that column.
- Side table `case_external_plugin_tab` — composite PK `(case_definition_key,
  case_definition_version_tag, tab_key)`, FK → `case_tab(...)` `ON DELETE CASCADE`, plus
  `external_plugin_configuration_id uuid not null` and nullable `bundle_key`. DDL lives in the core
  **release** changelog `backend/core/.../liquibase/13-32-0/20260622-add-case-external-plugin-tab.xml`
  (registered in `13-32-0-master.xml`), **not** in `initial-setup` — new changesets go in the
  current release folder.
- `CaseExternalPluginTabService` creates the side row on `CaseTabCreatedEvent` when
  `type == EXTERNAL_PLUGIN`; the configuration id + optional bundle key are parsed from the generic
  `contentKey` (`"<configId>[:<bundleKey>]"`), so the create path is untouched (mirrors WIDGETS) and
  **duplicate-on-copy is automatic** — the create event reconstructs the side row, no listener branch
  needed.
- Content endpoint `GET /api/v1/document/{documentId}/external-plugin-tab/{tabKey}` —
  USER-gated in `CaseHttpSecurityConfigurer` (mirroring `widget-tab`; a missing matcher would 403 by
  deny-by-default), runs the WIDGETS PBAC pattern (`CaseTab` VIEW with document context) and returns
  `{ bundleUrl, configurationId, bundleKey, context }` where
  `context = { documentId, caseDefinitionKey, caseDefinitionVersionTag, pluginConfigurationId }`.
- The bundle URL is resolved through a **one-directional SPI**: `ExternalPluginCaseTabResolver`
  (declared in `case`, consumed as `Optional` so case builds without external-plugin) implemented by
  `ExternalPluginCaseTabResolverImpl` in `external-plugin` (which now compile-depends on
  `:backend:case`, no cycle) → `${definition.baseUrl}/${definition.version}${bundle.path}` for the
  manifest's `case-tab` bundle (by `key`, or the sole one).
- **Admin UX** (`@valtimo/case-management`): "External plugin" in the add-tab type picker, disabled
  when no activated configuration exposes a `case-tab` bundle; an inline content selector lists
  activated configs' `case-tab` bundles (bundle-title suffix when a plugin ships more than one) and
  writes the `contentKey`. Tab dispatch (`@valtimo/case`) maps `ApiTabType.EXTERNAL_PLUGIN` to
  `CaseDetailExternalPluginTabComponent`, which loads the content endpoint, mints a user token, and
  renders `<valtimo-external-plugin-iframe>` (re-minting before the ≤15-min expiry).

### 13.2 Parent-proxy transport — the iframe holds no token ✅

The original design proposed passing the user token into the iframe via `init` and letting the
iframe fetch with it. **That was not implemented.** The iframe is rendered at an **opaque origin**
(`sandbox="allow-scripts allow-forms"`, *without* `allow-same-origin`; `allow-forms` lets a task-form
submit through an idiomatic `<form>` — §13.6 — and does not affect origin isolation) and never holds a
credential:

- The bundle calls `sdk.callValtimo(method, path, body?)` or `sdk.getPluginData(path)`; the frontend
  SDK emits a correlation-id-keyed `proxyRequest` postMessage to the Angular parent and awaits a
  `proxyResponse`.
- `ExternalPluginIframeComponent` performs the call and posts back the **data only**. For GZAC
  (`target:"gzac"`) it uses a **raw `fetch`** (not Angular `HttpClient`, so the Keycloak bearer
  interceptor never attaches the full Keycloak token — a confused-deputy guard) with the downscoped
  user token over a same-origin relative `/api/...` path (**zero CORS**). For plugin data
  (`target:"plugin"`) it POSTs to the host `/data` route (cross-origin; the host serves
  `Access-Control-Allow-Origin: *`).
- Inbound messages are validated by `event.source === iframe.contentWindow` (an opaque-origin iframe
  reports `event.origin === "null"`); the token never enters a postMessage.
- **Why opaque-origin matters for escalation:** a same-origin (`allow-same-origin`) iframe could read
  the GZAC app's session / full Keycloak token and escalate beyond the allowlist. The opaque origin
  forecloses that, and is the reason the parent-proxy is retained even when token *confidentiality*
  is not a concern.

### 13.3 Downscoped user token ✅

- **Mint endpoint** `POST /api/v1/external-plugin/configuration/{configurationId}/user-token` —
  deliberately **non-management** and **not ADMIN-gated** (any authenticated user; the result is
  always bounded by PBAC ∩ allowlist). Explicitly whitelisted `.authenticated()` in
  `ExternalPluginHttpSecurityConfigurer`. Reads the current user via
  `SecurityUtils.getCurrentUserLogin()/getCurrentUserRoles()`, verifies the configuration exists, and
  returns `{ userToken, expiresAt }`.
- **Token** (`ExternalPluginUserTokenService`): HS256, `sub=userLogin`, custom `roles` claim,
  `plugin_config_id`, `type=external_plugin_user`, `iss=valtimo-gzac`, `iat`, `exp`. TTL from
  `valtimo.external-plugin.user-token.ttl`, **hard-capped at 15 minutes**. Signed with the same
  `SHA-256(valtimo.plugin.encryption-secret)` key as the service token; `ExternalPluginUserTokenKeyProvider`
  discriminates by `type`.
- **Recognition** (`ExternalPluginUserTokenFilter`, before `BearerTokenAuthenticationFilter` in
  `ExternalPluginCallbackHttpSecurityConfigurer`): sets an `ExternalPluginUserPrincipal`, strips the
  `Authorization` header, and — the **one critical divergence** from the service-token filter — does
  **NOT** `runWithoutAuthorization`. PBAC stays fully active.
- **Principal** `ExternalPluginUserPrincipal(userLogin, roles, pluginConfigId) : UserDetails` —
  **not** a `SystemPrincipal`. `getUsername()` = the user login (so `getCurrentUserLogin()` and PBAC
  conditions referencing the current user behave as for a Keycloak session); authorities = the token
  roles (so `getCurrentUserRoles()` round-trips). Roles are frozen ≤15 min — no Keycloak round-trip.
- **Enforcement**: `ExternalPluginEndpointAllowlistFilter` now extracts the `pluginConfigId` from
  **either** `ExternalPluginServicePrincipal` **or** `ExternalPluginUserPrincipal` and intersects with
  the configuration's granted endpoints. Net for the user token: **PBAC (enforced, not bypassed) ∩
  allowlist**.

### 13.4 Plugin backend, as the user (`gzacApi.asUser`) ✅

A `handle_request` handler can call GZAC **as the user** — not just as the system — via
`gzacApi.asUser.{get,post,put,delete}` (the existing `gzacApi.*` stays service-token). The parent
forwards the downscoped user token in the `/data` POST body; `callRequest` threads it through the
Extism per-call `hostContext` (host-only, **never** serialised into the Wasm input), and the
`gzac_api` host function uses it when the request carries `as:"user"` (401-shaped reply if absent),
else the service token. ⚠️ This hands the user token to the **plugin host** — a deliberate relaxation
of "the token never leaves the browser," bounded by PBAC ∩ allowlist + the short TTL; plugin code
receives data, never the token.

### 13.5 Four communication levels (sample plugin) ✅

The `case-summary` case tab demonstrates, side by side:

1. **tab → GZAC (user token)** — `sdk.callValtimo` via the parent-proxy; PBAC ∩ allowlist.
2. **tab → plugin backend (static)** — `sdk.getPluginData("/summary")` → `handle_request`, no GZAC.
3. **tab → plugin backend → GZAC (user token)** — `gzacApi.asUser`; row-level PBAC ∩ allowlist.
4. **tab → plugin backend → GZAC (service token)** — `gzacApi`; PBAC-bypassed, allowlist-only —
   scope broader than the user.

Levels 3 & 4 count cases via `POST /api/v1/case/{key}/search` (`totalElements`), a **row-level
PBAC-filtered** list, so the user token returns the user's visible subset and the service token the
full set — a faithful scope comparison. (A single-document GET can't show this: it's all-or-nothing
and the user already has access to the case whose tab they opened — so it was replaced by the count.)
This adds `{ "method": "POST", "pattern": "/api/v1/case/*/search" }` to the sample manifest's
`permissions.endpoints`; the configuration must be (re)granted it for the allowlist to permit either
token.

Service tokens (action/event callbacks) are unchanged. ⚠️ The host `/data` route is still **public**
(§7), so a level-4 handler exposes system-scoped data unauthenticated — gating `/data`
(capability/auth) is the priority hardening item before non-POC use, and matters far more for
privilege-escalation than the front-end transport choice.

### 13.6 Task-form surface (`external_plugin_task_form` process-link type) ✅

A plugin renders the form for a **user task**, and **GZAC completes the task the same way it completes
every other form** (form.io / URL process links): the form's data is submitted to a GZAC endpoint,
GZAC resolves the values and completes the task server-side through `ProcessDocumentService`. The
plugin is an *optional participant* in the submission, not the driver of completion.

Three capability levels are supported (see the `case-summary` sample below):

- **Level 0 — pure form, zero backend code.** The bundle collects input and calls `sdk.submitTask(data)`
  with value-resolver-prefixed keys (`pv:approved` → process variable, `doc:/reviewComment` → case
  document field; unprefixed keys default to process variables). GZAC resolves them and completes the
  task. No `request()` handler, no `permissions.endpoints`, no user token.
- **Level 1 — transform / validate hook.** The `task-form` bundle declares `submitHandler: true`. During
  submission GZAC first calls the plugin's `handle_submit` export (server-to-server, HMAC, service
  token — the same rails as actions) with `{ configurationId, taskId, processInstanceId, documentId,
  submission }`. The hook returns `{ status:"completed", variables, documentContent }` (GZAC completes
  the task with those values) or `{ status:"error", errorMessage, fieldErrors }` (GZAC does **not**
  complete; the errors are surfaced on the form). Covers custom validation, derived variables,
  enrichment, and rejecting bad input with per-field messages.
- **Level 2 — full custom (escape hatch, retained).** The bundle drives completion itself via
  `sdk.postPluginData("/submit-task")` → `handle_request` → `gzacApi.asUser.post('/api/v1/task/{id}/complete')`
  (level 3, §13.5), then emits `taskCompleted`. Needs the task-complete grant. Not the default —
  kept for genuinely custom needs.

**Why this shape.** The earlier design made the *plugin* drive completion: every task-form plugin
needed a hand-written `/submit-task` handler, a `POST /api/v1/task/*/complete` grant, and the
downscoped-token machinery — and it went through the plain task-complete endpoint, bypassing the
value-resolver / document-update pipeline, so it was strictly *less* capable than a form.io task. The
new model makes GZAC the driver, so a plugin form gets the full pipeline (value resolvers, `doc:`
document updates, submission storage, the `TaskCompleted` outbox event, PBAC) for free, with the hook
as a principled place for custom backend logic and Level 2 as the escape hatch.

Structure:

- **Process-link type** `external_plugin_task_form` is a distinct `ProcessLink` subtype, kept separate
  from the `external_plugin` service-task action type because the surfaces are unrelated (a form to
  render vs. a backend action to invoke). Entity `ExternalPluginTaskFormProcessLink` maps
  `external_plugin_task_form_{config_id,bundle_key}` on the shared `process_link` table (DDL in
  the release changelogs `13-32-0/20260706-add-external-plugin-task-form-process-link.xml` +
  `13-32-0/20260720-plugin-configuration-reference-external-plugin-version.xml`, not in
  `initial-setup`); the plugin identity/version rides on the shared reference columns like the
  action link's (§5). It ships the five `ProcessLinkMapper` DTOs and a `SupportedProcessLinkTypeHandler`
  that declares **`USER_TASK_CREATE`** (the action type declares `SERVICE_TASK_START`).
- **Render descriptor, no dedicated open controller.** A `ProcessLinkActivityHandler` (shaped like the
  URL/UI-component handlers — a render descriptor, not an execution listener) answers the generic
  `GET /api/v2/process-link/task/{taskId}` with an `external-plugin-task-form`
  `ProcessLinkActivityResult` carrying `{ bundleUrl, configurationId, bundleKey, context }` (plus the
  result's own `processLinkId`), where `context = { taskId, processInstanceId, documentId,
  pluginConfigurationId }`. `taskId` is authoritative — supplied by the backend, never read from the
  browser's request body.
- **Submission — a vertical slice mirroring form.io.** `ExternalPluginTaskFormSubmissionResource`
  exposes `POST /api/v1/process-link/{processLinkId}/external-plugin-task-form/submission
  ?documentId=&taskInstanceId=` (`.authenticated()` in `ExternalPluginHttpSecurityConfigurer`).
  `ExternalPluginTaskFormSubmissionService` loads the link, asserts the caller's COMPLETE permission,
  optionally runs the Level 1 hook (via `ExternalPluginHostClient.invokeSubmit` → host
  `POST /plugins/:id/:version/submit/:key` → `pluginManager.callSubmit` → Wasm `handle_submit`),
  categorizes the effective submission by value-resolver prefix (`pv:` → process vars, everything else
  with a `:` prefix → value-resolver values applied to the document, unprefixed → process vars), and
  dispatches a `ModifyDocumentAndCompleteTaskRequest` through `ProcessDocumentService` — the identical
  path `form`/`url` use. With no case document it falls back to `OperatonTaskService
  .completeTaskWithFormData(taskId, processVars)`. A Level 1 hook rejection returns an
  `ExternalPluginTaskFormSubmissionResult { errors, fieldErrors, documentId }` with HTTP 400 and never
  completes the task.
- **Bundle URL resolution.** `ExternalPluginBundleUrlResolver.resolve(configurationId, bundleType,
  bundleKey)` resolves `${definition.baseUrl}/${definition.version}${bundle.path}` for the manifest's
  `task-form` bundle; the case-tab (§13.1) and task-form surfaces share it.
- **Delete guard.** `ExternalPluginHostUsageResolver` unions task-form links with action links, so a
  configuration referenced by a task form blocks deletion of its plugin/host (§12).
- **Admin UX** (`@valtimo/process-link`). There is no separate tile: an external plugin's task-form is
  configured inside the **"Plugin"** flow. On a user task the plugin's `task-form` bundles are listed as
  the selectable options in the "choose action" step (in place of service-task actions), the "configure"
  step has nothing to fill in, and saving writes the `external_plugin_task_form` link. This works
  because external plugin **actions are activity-type filtered**: `SelectPluginActionComponent` offers an
  action only for the activity types its manifest declares (`SERVICE_TASK_START`, …), so a user task
  surfaces the plugin's forms rather than its actions (and an action can never be linked to an activity
  where it could not run). The process-link framework resolves the link type by Jackson **deduction**
  (which fields are present, not `processLinkType`), so the create/update DTO always serialises
  `bundleKey` (null for a plugin's sole, unkeyed bundle) to stay distinguishable from the action link,
  which is identified by its `actionKey`. The BPMN properties-panel "Process link" preview shows the
  bundle key with a purple **Plugin** tag; the stepper labels external actions/forms by their manifest
  title rather than a translation-bundle lookup (external plugins have no embedded translation bundle).
- **Iframe sandbox.** The plugin iframe is sandboxed `allow-scripts allow-forms` (still without
  `allow-same-origin`, §13.2). `allow-forms` lets a task-form submit through an idiomatic `<form>`: the
  bundle's submit handler forwards the data by postMessage, but without `allow-forms` the browser blocks
  the submit before that handler runs. It grants nothing a script cannot already do (a script can POST
  via `fetch`) and preserves the opaque origin.
- **Runtime** (`@valtimo/task`). `TaskDetailContentComponent` maps the `external-plugin-task-form`
  result to `TaskExternalPluginFormComponent` (passing `processLinkId`), which embeds
  `<valtimo-external-plugin-iframe>`. For Level 0/1 the bundle calls `sdk.submitTask(data)`; the iframe
  emits a `submitTask` postMessage, surfaced as `submitTaskEvent`, and the component POSTs the data to
  the submission endpoint via `ExternalPluginTaskFormSubmissionService` (the Angular parent submits,
  under the logged-in user's Keycloak session — **no downscoped token needed for submission**, and the
  authoritative `taskInstanceId`/`documentId` come from the process-link result, not the iframe). On
  success it emits `completedEvent` (parent closes the task + refreshes) and replies `submitResult{ok:true}`;
  a validation failure replies `submitResult{ok:false, errors, fieldErrors}` so the form renders inline
  errors without being torn down. The Level 2 `taskCompleted` → `taskCompletedEvent` path is retained.
  The downscoped user token is now minted **best-effort** (only Level 2 and live in-form GZAC reads
  need it), so a pure Level 0/1 form still renders and submits if the mint fails.
- **SDK.** `task-form` is a `FrontendBundle.type` (checked by the shared manifest validator), and the
  bundle may set `submitHandler: true` (Level 1). The backend SDK adds `submit(key, handler)` plus the
  `handle_submit` Wasm export (wired automatically by the build tool alongside `handle_action`/
  `_event`/`_request`) and the `SubmitInput`/`SubmitOutput` types. The frontend SDK adds
  `sdk.submitTask(data): Promise<{ ok, errors?, fieldErrors? }>` (the `submitTask`/`submitResult`
  postMessage pair); `postPluginData` + `taskCompleted` remain for Level 2.
- **Sample** (`case-summary`). Ships three `task-form` bundles demonstrating the levels side by side:
  `approve` (Level 0 — sends `pv:`/`doc:` prefixed fields, no backend code), `review` (Level 1 —
  `submitHandler: true` + a `submit("review", …)` hook that rejects a rejection with no comment via
  `fieldErrors` and otherwise derives variables + a document field), and `custom` (Level 2 — the
  `/submit-task` `request()` handler completing via `gzacApi.asUser`, with `permissions.endpoints`
  granting `{ "method": "POST", "pattern": "/api/v1/task/*/complete" }`, the only bundle that needs it).

## 14. Not yet implemented ⛔

- **Auth/capability gating of the public host `/data` route** (`handle_request`) — today it executes
  plugin Wasm unauthenticated and a service-token-backed handler can return system-scoped data
  (§7, §13.5). This is the top hardening item.
- HTMX `render_page` (only the RPC-style `handle_request` for JSON data is implemented).
- Case **widgets** (the remaining iframe surface — the case **tab** (§13.1), **task form** (§13.6),
  and **menu pages** (§17) are done).
- DLQ for nacked or expired messages (today `nack(false,false)` drops, `x-expires` deletes the
  queue and its contents).

## 15. Roadmap (priority order)

1. **Harden the host `/data` route** — capability/auth gating so a `handle_request` handler can't be
   triggered (and can't reach the service token) unauthenticated; tighten the allowlist surface.
2. Remaining iframe surfaces: HTMX pages, case widgets (case **tab** §13.1, **task form** §13.6,
   and **menu pages** §17 done).
3. Cleanup: align async-vs-sync SDK docs.

## 16. Verification status

- Host `tsc` build and `@valtimo/plugin-sdk` build: clean (including the optional-TLS
  `buildHttpsOptions` wiring in `plugin-host/app/src/index.ts`).
- Backend `:backend:external-plugin:test`: BUILD SUCCESSFUL (allowlist **for both the service and the
  user principal** + service-token-filter + service-token-ttl + **user-token suites** +
  **task-form-submission suite** + endpoint-
  description-coverage + host-client-HMAC + host-registration transport-guard + compatibility +
  event-queue mode/TTL tests). The endpoint-description-coverage suite
  (`EndpointDescriptionCoverageTest`, §3.8/§4) scans every controller on the test classpath and fails
  unless each handler carries an `@EndpointDescription` with both `en` and `nl` text — so the
  user-token (`ExternalPluginUserTokenResource`), case-tab (`CaseExternalPluginTabResource`) and
  task-form-submission (`ExternalPluginTaskFormSubmissionResource`) endpoints declare descriptions like
  every other endpoint (and the scan additionally required — and now carries — descriptions on
  `ObjectManagementConsumerResource` and `PbacRegistryResource`, which the wider test classpath pulls
  in). The task-form-submission suite (`processlink/ExternalPluginTaskFormSubmissionServiceTest`)
  asserts a Level 1 hook rejection surfaces `fieldErrors` and **never** completes the task
  (`ProcessDocumentService.dispatch` and `completeTaskWithFormData` un-called), and that a Level 0
  submission with no hook categorizes prefixed/unprefixed values and completes via
  `completeTaskWithFormData`. The user-token suites assert: the minted JWT's claims
  (`sub`/`roles`/`plugin_config_id`/`type`) and that the TTL defaults to and is capped at 15 min
  (`ExternalPluginUserTokenServiceTest`); the filter authenticates a valid token, rebuilds the user's
  authorities from the `roles` claim, strips the `Authorization` header, and — critically — leaves
  `AuthorizationContext.ignoreAuthorization` **false** so PBAC stays active (`ExternalPluginUserTokenFilterTest`);
  and `ExternalPluginEndpointAllowlistFilterTest` permits a granted and denies an ungranted
  `(method, path)` for an `ExternalPluginUserPrincipal`. The bundle-resolver SPI
  (`ExternalPluginCaseTabResolverImplTest`) asserts URL construction by bundle key / sole bundle and
  null-handling. The host-client-HMAC suite
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
  `CONFLICT` status, `hostId`, and the `PluginUsageDto` fields). The service-token suite
  (`service/ExternalPluginServiceTokenServiceTest`) asserts the issued JWT's `exp − iat` equals the
  configured TTL and falls back to 24h when none is set.
- Backend `:backend:plugin:test` (`service/PluginServiceTest`): BUILD SUCCESSFUL — embedded
  `deletePluginConfiguration` proceeds when no fixed process link references the configuration,
  throws `PluginConfigurationInUseException` with the `usages` payload when one does, and a
  not-found id is a no-op warning.
- Backend `:backend:app:gzac:compileKotlin`: BUILD SUCCESSFUL.
- Frontend: `@valtimo/plugin` and `@valtimo/task` `ng build` clean (typechecks the task-form submission
  service, the iframe component's `submitTask`/`submitResult` wiring, and the `TaskExternalPluginFormComponent`
  templates); full production `ng build` clean.
- Sample plugin `build:pack`: clean — the Wasm now exports `handle_submit` alongside
  `handle_action`/`_event`/`_request`, and all frontend bundles build, including the **three task-form
  bundles** (`approve` Level 0, `review` Level 1 with `submitHandler: true`, `custom` Level 2); the
  pack also includes `logo.svg`, `translations.en/nl`, `permissions.endpoints`, and `eventSubscriptions`.
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
- Case-tab surface (§13), end-to-end in the browser (sample `case-summary` tab on a seeded
  `EXTERNAL_PLUGIN` tab): the iframe loads at an opaque origin and renders all four communication
  levels — hello-world, plugin-served `/summary`, `tab → GZAC (user token)`, and the
  `tab → plugin backend → GZAC` user-vs-service case counts. Confirmed the content endpoint and the
  non-management user-token mint endpoint needed explicit `HttpSecurityConfigurer` matchers (a
  missing matcher 403s by deny-by-default), and that the parent-proxy `POST .../data` fetch needed
  the host origin on CSP `connect-src` (the iframe loaded via `frame-src` but the fetch was
  CSP-blocked until `connect-src` was augmented — §10). The `@valtimo/{case,case-management,plugin}`
  libs and the sample plugin `build:pack` are clean.

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
- The **task-form submission round-trip** (§13.6) — `sdk.submitTask` → `submitTask` postMessage →
  `ExternalPluginTaskFormSubmissionService` POST → `ProcessDocumentService` completion for Level 0, and
  the Level 1 `handle_submit` HMAC hop (validation rejection surfacing `fieldErrors` on the form vs. a
  successful transform completing the task) — is covered by unit tests, clean lib builds, and the
  sample `build:pack`, but a live browser run of all three levels against a running task is not yet in
  the verified record. Level 2 reuses the previously code-verified `handle_request`/`gzacApi.asUser`
  path.
- The **building-block, import-parity, and result-write-back features** (§19–§21) are verified by
  unit suites (`:backend:{plugin,plugin-valtimo,external-plugin,building-block,process-link,case}:test`),
  `:backend:external-plugin:integrationTestingPostgresql` / `:backend:plugin:integrationTesting{Postgresql,Mysql}`
  (which run every Liquibase changelog against real databases), clean `ng build` of
  `@valtimo/{process-link,case-management,plugin,shared}`, SDK/host `tsc`, and the sample
  `build:pack` — but not by a live run. Outstanding live checks: a BB call activity resolving an
  external action through the namespaced mapping and invoking the host; a result mapping writing to
  a real case/BB document (`doc:`/`pv:`); the import wizard round-trip in the browser (external rows
  mapped, external case tab surviving import with its side row); and the dangling-import → issue
  banner → repair flow.

## 17. Apps — URL plugins ✅

An **app** is a remote HTTP service, added by URL, that **is a plugin-host-plus-single-plugin**: it
speaks the exact same GZAC↔host contract (discovery, HMAC-signed pushes/actions, public
iframe/data routes) but serves one natively-implemented plugin and accepts no uploads. Terminology:
an **integration** is the umbrella for a **plugin host** or an **app**.

The whole feature is a thin discriminator over the existing machinery — no new tables, no new
endpoints, no duplicated token/HMAC/discovery/iframe code:

- **`external_plugin_host.kind`** (`ExternalPluginHostKind = PLUGIN_HOST | APP`, default
  `PLUGIN_HOST`, `20260708-external-plugin-host-kind.xml`). Carried through `HostCreateRequest` /
  `HostResponse` and `ExternalPluginHostService.register()`.
- **Immediate discovery on registration** — `createHost()` calls the new
  `ExternalPluginDiscoveryService.discoverHost(hostId)` for an APP so its single plugin is
  discovered and configurable at once instead of on the next ≤60 s poll. Best-effort; the periodic
  cycle reconciles regardless.
- **Upload guard** — `ExternalPluginHostService.uploadPlugin()` rejects an APP host (an app serves
  its own plugin); the UI hides upload for apps and restricts the upload host list to
  `kind = PLUGIN_HOST`.
- **Admin UX** — the "Plugin hosts" tab becomes **Integrations** with a **Type** tag column; an
  **Add app** button opens the shared host modal in APP mode. Discovery, configuration, permissions,
  process-link/case-tab/task-form binding, and deletion guards are all reused unchanged, because an
  app's single plugin surfaces as an ordinary `external_plugin_definition`.

Everything downstream of registration is identical to a plugin host, so an app gets service tokens,
the endpoint allowlist, user tokens, iframe surfaces, and event delivery for free.

**Reference app.** `plugin-host/sample-apps/demo-app/` is a standalone Node + Fastify service that
implements the contract natively (no Extism) for one plugin — action (`greet`, `SERVICE_TASK_START`
+ service-token callback), config + action-config + case-tab iframe bundles (built with esbuild
against `@valtimo/plugin-sdk/frontend`), a `handle_request` `/data` route (levels 2–4), and a
RabbitMQ event consumer that notes back on `document.created`. HMAC verification reproduces
`ExternalPluginHmacSigner` byte-for-byte. It doubles as living documentation of the app contract.

**Verification.** `:backend:external-plugin:test` (incl. new `register`-persists-kind,
APP-upload-rejected, and default-kind cases) and `:backend:app:gzac:compileKotlin` BUILD SUCCESSFUL.
Demo app `npm run build` clean (server `tsc` + three iframe bundles); a live run confirmed `/health`,
the public `/plugin-manifest`, a correctly-signed `GET /api/host/plugins` (→ 200 with the single
plugin), and an unsigned / wrong-secret call (→ 401). Frontend `@valtimo/{plugin,plugin-management}`
type-check clean; `en`/`nl` bundles updated (`addApp`, `tabs.integrations`, `labels.kind`, `kind.*`).

## 18. Host capabilities — `gzac_api`, `http_request`, `kv`, `log` ✅

A capability is a host function a plugin may call. Every capability requires an explicit grant:
the plugin declares what it needs in `manifest.permissions.capabilities`, the admin accepts each
one during configuration (§4), and the host enforces the allowlist at call time. A plugin that
calls a capability it was not granted receives a structured error — never silent access, never
a crash.

### 18.1 Manifest declaration

```json
{
  "permissions": {
    "capabilities": ["gzac_api", "http_request", "kv", "log"],
    "endpoints": [
      { "method": "GET", "pattern": "/api/v1/document/*" }
    ]
  }
}
```

`permissions.capabilities` is a string array. Known capability names: `gzac_api`, `http_request`,
`kv`, `log`. Unknown names are rejected at upload (manifest validation, §9). `endpoints` remains
relevant only when `gzac_api` is declared — it scopes *which* GZAC REST endpoints the service/user
token may reach. A plugin that does not declare `gzac_api` has no use for `endpoints`.

**SDK type** (`PluginManifest`): `permissions?: { endpoints?: Endpoint[]; capabilities?: string[] }`.
The `capabilities` field is added to the existing `permissions` object. Manifest validation
(`validatePluginManifest`) rejects unknown capability names and requires the array when any
capability-dependent feature is declared (e.g. `endpoints` without `gzac_api` is a validation
error).

### 18.2 GZAC-side storage and activation gate

**New table** `external_plugin_granted_capability` (DDL in a new changeset under the current
release changelog, e.g. `13-32-0/2026MMDD-external-plugin-granted-capability.xml`):

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `configuration_id` | `uuid NOT NULL` | FK → `external_plugin_configuration` |
| `capability` | `varchar(64) NOT NULL` | e.g. `gzac_api`, `http_request`, `kv`, `log` |
| `granted_at` | `timestamptz NOT NULL` | |

`UNIQUE(configuration_id, capability)`.

`ExternalPluginConfigurationService.create()` receives `grantedCapabilities: List<String>` and
runs `validateGrantedCapabilitiesCoverManifest()` — rejects the configuration unless every
capability declared in the manifest is granted (all-or-nothing, matching endpoints and events).
The granted capabilities are persisted and pushed to the host alongside the configuration (§18.3).
`update()` does not accept `grantedCapabilities` — capability grants are immutable after
activation (same semantics as event grants).

**New Kotlin domain** `ExternalPluginGrantedCapability` (entity),
`ExternalPluginGrantedCapabilityRepository` (Spring Data JPA).

### 18.3 Config push — capabilities to the host

The GZAC config-push body gains a `grantedCapabilities` array:

```json
{
  "pluginId": "case-summary",
  "pluginVersion": "0.1.0",
  "properties": { },
  "serviceToken": "eyJ…",
  "gzacBaseUrl": "http://gzac:8080",
  "grantedCapabilities": ["gzac_api", "http_request", "kv", "log"],
  "eventSubscriptions": ["com.ritense.valtimo.document.created"],
  "eventBroker": { }
}
```

The host's `ConfigRepository` stores `granted_capabilities JSONB NOT NULL DEFAULT '[]'` on
`plugin_configurations` (migration version 3). `ConfigRegistry` passes it through, and
every host function checks it before executing.

### 18.4 Host-side enforcement

Each host function checks the calling configuration's granted capabilities at the start of every
invocation. The `hostContext` (already carries `configurationId`) is used to look up the
configuration's `grantedCapabilities` from the `ConfigRegistry`. If the required capability is
absent, the host function returns a capability-denied error response without performing any work.

```
gzac_api    → requires "gzac_api" in grantedCapabilities
http_request → requires "http_request" in grantedCapabilities
kv          → requires "kv" in grantedCapabilities
log         → requires "log" in grantedCapabilities
```

The check is implemented as a shared `assertCapability(configRegistry, configurationId, name)`
helper used by all four host functions. On denial the Wasm call receives a structured JSON error
`{ status: 403, body: { error: "Capability 'X' not granted for this configuration" } }` —
deterministic, never ambiguous.

**`gzac_api` retroactive gate.** The existing `gzac_api` host function (`host-functions/gzac-api.ts`)
gains the capability check at the top of its handler, before any upstream fetch. Configurations
created before the capability system was introduced will not have `grantedCapabilities` in their
pushed config. To avoid breaking existing setups: when `grantedCapabilities` is absent or empty
on a configuration that was pushed by an older GZAC (before the capability system), the host
treats `gzac_api` as implicitly granted (backward compatibility). Once the GZAC is upgraded and
re-pushes configurations with explicit `grantedCapabilities`, the host enforces the explicit list.

### 18.5 Capability: `gzac_api` (host function + capability gate ✅)

Already implemented as a host function (§3.5, `host-functions/gzac-api.ts`). The capability gate
is the only addition: the host function checks `grantedCapabilities` before making the upstream
call. Everything else — service/user token selection, endpoint allowlist enforcement on the GZAC
side, HMAC signing — is unchanged.

SDK: `gzacApi.get()`, `gzacApi.post()`, etc. (unchanged). `gzacApi.asUser.*` (unchanged).

### 18.6 Capability: `http_request` ⛔

Allows the plugin to make HTTP requests to external (non-GZAC) services. The host performs the
fetch and returns the response; the plugin never gets raw network access.

**Host function** `http_request` (`host-functions/http-request.ts`):

```typescript
interface HttpRequestInput {
  method: string;     // GET, POST, PUT, DELETE, PATCH
  url: string;        // Full URL — must not target gzacBaseUrl (enforced)
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number; // default 30_000, max 60_000
}

interface HttpRequestOutput {
  status: number;
  headers: Record<string, string>;
  body: unknown;      // parsed as JSON when possible, otherwise raw text
}
```

**Security constraints:**
- The `url` must not resolve to the configuration's `gzacBaseUrl` — use `gzac_api` for that. The
  host strips `Authorization` headers pointing at the GZAC instance to prevent credential relay.
- Timeout is capped at 60 s to prevent resource exhaustion.
- The host does not follow redirects that would land on `gzacBaseUrl`.

**Logging:** Every `http_request` call is logged to the plugin host's `plugin_api_call_logs` table
(§18.9) with method, URL (query string redacted), status, duration, and the calling
configuration/plugin id. This gives the admin visibility into what external calls plugins make.

**SDK** (`plugin-sdk/src/http-request.ts`):

```typescript
export const httpRequest = {
  get<T = unknown>(url: string, headers?: Record<string, string>): HttpRequestResponse<T>;
  post<T = unknown>(url: string, body?: unknown, headers?: Record<string, string>): HttpRequestResponse<T>;
  put<T = unknown>(url: string, body?: unknown, headers?: Record<string, string>): HttpRequestResponse<T>;
  delete<T = unknown>(url: string, headers?: Record<string, string>): HttpRequestResponse<T>;
};
```

Mirrors the `gzacApi` shape. Calls the `http_request` Extism host function under the hood, same
`Host.getFunctions()` mechanism.

### 18.7 Capability: `kv` ⛔

A per-configuration key-value store persisted in the plugin host's PostgreSQL. Plugins use it to
store state across invocations — counters, cached computations, user preferences, etc.

**Host function** `kv` (`host-functions/kv.ts`):

```typescript
interface KvInput {
  op: "get" | "set" | "delete" | "list";
  key?: string;       // required for get/set/delete; max 256 chars
  value?: unknown;     // required for set; stored as JSONB; max 1 MB serialized
  prefix?: string;     // for list — returns keys matching this prefix
}

interface KvOutput {
  status: number;      // 200 on success, 404 on missing key
  value?: unknown;     // for get
  keys?: string[];     // for list
}
```

**Storage** (`plugin_kv_store` table in the host's PostgreSQL, §18.9):

| Column | Type | Notes |
|--------|------|-------|
| `configuration_id` | `text NOT NULL` | scoped to the configuration |
| `key` | `text NOT NULL` | max 256 chars, validated host-side |
| `value` | `jsonb NOT NULL` | max 1 MB serialized |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

PK: `(configuration_id, key)`. Deleting a configuration from the host (config-push DELETE)
cascades to its KV entries.

**SDK** (`plugin-sdk/src/kv.ts`):

```typescript
export const kv = {
  get<T = unknown>(key: string): T | undefined;
  set(key: string, value: unknown): void;
  delete(key: string): boolean;
  list(prefix?: string): string[];
};
```

Synchronous from the plugin's perspective (Extism suspends the call).

### 18.8 Capability: `log` ⛔

Structured logging persisted in the plugin host's PostgreSQL. Replaces the existing console-based
`log.info/warn/error` (which already exist in `host-functions.ts` but only pipe to stdout/stderr)
with a host function that both logs to the host's pino logger *and* persists to the
`plugin_structured_logs` table for admin visibility.

**Host function** `log` (`host-functions/log.ts`):

```typescript
interface LogInput {
  level: "info" | "warn" | "error" | "debug";
  message: string;          // max 4 KB
  data?: Record<string, unknown>;  // structured context, max 64 KB serialized
}
```

No output — fire-and-forget from the plugin's perspective. The host function:
1. Writes to the pino logger at the requested level (existing behaviour, now with structured
   `data` attached).
2. Inserts a row into `plugin_structured_logs` (§18.9) — async insert, does not block the Wasm
   call. Failures are logged to pino but do not bubble to the plugin.

**SDK** (`plugin-sdk/src/host-functions.ts` — the existing `log` export is enhanced):

```typescript
export const log = {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
};
```

The existing `log.info/warn/error` signatures are kept for backward compatibility; the new `data`
parameter is optional. `debug` is added. Outside Wasm (build/test), falls back to `console.*`.

### 18.9 Host persistent storage — new tables (plugin host PostgreSQL)

Three new tables in the plugin host's PostgreSQL (migration versions 3–5 in
`plugin-host/app/src/db/index.ts`):

**Migration 3: `granted_capabilities` column on `plugin_configurations`**

```sql
ALTER TABLE plugin_configurations
  ADD COLUMN IF NOT EXISTS granted_capabilities JSONB NOT NULL DEFAULT '[]';
```

**Migration 4: `plugin_kv_store`**

```sql
CREATE TABLE IF NOT EXISTS plugin_kv_store (
  configuration_id TEXT NOT NULL,
  key TEXT NOT NULL CHECK (length(key) <= 256),
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (configuration_id, key)
);
CREATE INDEX IF NOT EXISTS idx_kv_store_config ON plugin_kv_store(configuration_id);
```

**Migration 5: `plugin_structured_logs`**

```sql
CREATE TABLE IF NOT EXISTS plugin_structured_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_id TEXT NOT NULL,
  plugin_id TEXT NOT NULL,
  plugin_version TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  invocation_type TEXT,        -- 'action', 'event', 'request', 'submit'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_structured_logs_config_time
  ON plugin_structured_logs(configuration_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_structured_logs_plugin_time
  ON plugin_structured_logs(plugin_id, plugin_version, created_at DESC);
```

**Migration 6: `plugin_api_call_logs`**

```sql
CREATE TABLE IF NOT EXISTS plugin_api_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_id TEXT NOT NULL,
  plugin_id TEXT NOT NULL,
  plugin_version TEXT NOT NULL,
  capability TEXT NOT NULL,     -- 'gzac_api' or 'http_request'
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  status_code INTEGER,
  duration_ms INTEGER,
  error_message TEXT,
  invocation_type TEXT,        -- 'action', 'event', 'request', 'submit'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_call_logs_config_time
  ON plugin_api_call_logs(configuration_id, created_at DESC);
```

**Repositories:**
- `KvRepository` (`db/kv-repository.ts`) — `get`, `set`, `delete`, `list`, `deleteAll(configId)`.
- `LogRepository` (`db/log-repository.ts`) — `insert`, `query(configId, { page, size, level?,
  after?, before? })`, `deleteOlderThan(configId, retentionDays)`.
- `ApiCallLogRepository` (`db/api-call-log-repository.ts`) — `insert`, `query(configId, { page,
  size, capability?, after?, before? })`, `deleteOlderThan(configId, retentionDays)`.

**Retention.** A scheduled cleanup job runs on host startup and every 24 h, deleting log and
API-call rows older than a configurable retention period (`LOG_RETENTION_DAYS` env, default 30).
KV entries have no automatic retention — they persist until explicitly deleted by the plugin or
when the configuration is removed.

**Config deletion cascade.** When a configuration is removed from the host (via the
`DELETE /api/host/configurations/:configId` route), the host deletes the configuration's KV
entries, structured logs, and API call logs. The SQL cascade is manual (repository calls in the
delete handler), not FK-based, since `configuration_id` is `TEXT` referencing the config push id.

### 18.10 Host routes — log query endpoints

Two new HMAC-signed routes on the plugin host for the GZAC admin UI to query logs:

**`GET /api/host/configurations/:configId/logs`** — paginated structured logs.

Query params: `page` (0-based), `size` (default 25, max 100), `level` (optional filter),
`after` / `before` (ISO-8601 timestamps). Returns:

```json
{
  "content": [
    {
      "id": "uuid",
      "level": "info",
      "message": "[case-summary] event com.ritense.valtimo.document.created",
      "data": { "resultId": "abc-123" },
      "invocationType": "event",
      "createdAt": "2026-07-16T10:30:00Z"
    }
  ],
  "page": 0,
  "size": 25,
  "totalElements": 142
}
```

**`GET /api/host/configurations/:configId/api-call-logs`** — paginated API call logs.

Query params: same as above, plus `capability` (optional, `gzac_api` or `http_request`). Returns:

```json
{
  "content": [
    {
      "id": "uuid",
      "capability": "http_request",
      "method": "GET",
      "url": "https://jsonplaceholder.typicode.com/todos/1",
      "statusCode": 200,
      "durationMs": 245,
      "invocationType": "request",
      "createdAt": "2026-07-16T10:30:00Z"
    }
  ],
  "page": 0,
  "size": 25,
  "totalElements": 58
}
```

Both routes are HMAC-signed (§3.9) — the GZAC backend proxies the request via
`ExternalPluginHostClient`.

### 18.11 GZAC backend — log proxy endpoints

Two new management endpoints on the GZAC backend that proxy the host's log routes:

- `GET /api/management/v1/external-plugin/configuration/{configId}/logs`
- `GET /api/management/v1/external-plugin/configuration/{configId}/api-call-logs`

ADMIN-gated in `ExternalPluginHttpSecurityConfigurer`. The service looks up the configuration's
host, signs the request with HMAC, forwards query params, and returns the host's paginated
response. These need `@EndpointDescription(en, nl)` annotations (§4).

### 18.12 Frontend — admin log view modal

A new **"Logs"** option in the overflow menu (`ActionItem`) for external plugin configurations on
the plugin management page (`plugin-management.component.ts`). Clicking it opens a
`PluginLogModalComponent` — a `cds-modal` (size `lg`) containing a `valtimo-carbon-list` with
pagination, modeled after the existing `logging-list` pattern (§ frontend pattern reference).

**Overflow menu entry:**

```typescript
{
  callback: this.viewLogs.bind(this),
  label: 'pluginManagement.logs.menuItem',
  disabledCallback: (row: UnifiedPluginConfigurationRow) => row.source !== 'external',
}
```

Placed between "Edit" and "Delete" in the `actionItems` array. Disabled for embedded
(non-external) configurations.

**Modal component** (`plugin-management/components/plugin-log-modal/`):

The modal has two tabs (Carbon `cds-tabs`):

1. **Plugin logs** — structured logs from `plugin_structured_logs`. Table columns: timestamp
   (date-time format), level (tag: `info`=blue, `warn`=yellow, `error`=red, `debug`=gray),
   message (text with tooltip on overflow), invocation type (tag). Row click opens a detail
   section showing the `data` JSON.
2. **API calls** — from `plugin_api_call_logs`. Table columns: timestamp, capability (tag:
   `gzac_api`=teal, `http_request`=purple), method (tag), URL (text with tooltip), status code
   (tag: 2xx=green, 4xx=yellow, 5xx=red), duration (ms).

Both tabs use `valtimo-carbon-list` with `[pagination]` and `(paginationClicked)` /
`(paginationSet)`. Default page size 25. Each tab loads data independently on activation.

**Service** (`ExternalPluginService` additions):
- `getPluginLogs(configId, params): Observable<Page<PluginLogEntry>>`
- `getApiCallLogs(configId, params): Observable<Page<ApiCallLogEntry>>`

**i18n** — new keys under `pluginManagement.logs.*` in `en.json` and `nl.json`:
`menuItem`, `title`, `tabs.pluginLogs`, `tabs.apiCalls`, `columns.timestamp`, `columns.level`,
`columns.message`, `columns.invocationType`, `columns.capability`, `columns.method`,
`columns.url`, `columns.statusCode`, `columns.duration`, `empty`, `close`.

### 18.13 Demo plugin scenarios — `case-summary` enhancements ⛔

The sample plugin (`plugin-host/sample-plugins/case-summary/`) gains scenarios that exercise
`http_request`, `kv`, and `log` alongside the existing `gzac_api` usage, proving each capability
produces results visible in GZAC.

**Manifest additions:**

```json
{
  "permissions": {
    "capabilities": ["gzac_api", "http_request", "kv", "log"],
    "endpoints": [
      { "method": "GET", "pattern": "/api/v1/document/*" },
      { "method": "POST", "pattern": "/api/v1/document/*/note" },
      { "method": "POST", "pattern": "/api/v1/case/*/search" },
      { "method": "POST", "pattern": "/api/v1/task/*/complete" }
    ]
  }
}
```

**New `plugin.ts` scenarios:**

1. **`http_request` — fetch from a trusted test API.** A new `request("/external-data", …)`
   handler calls `httpRequest.get("https://jsonplaceholder.typicode.com/todos/1")` — a public,
   stable, no-auth JSON API. The response (a todo item with `id`, `title`, `completed`) is
   returned to the case-tab iframe, which renders it in a new "External API data" card alongside
   the existing cards. This proves `http_request` works end-to-end: the plugin makes an outbound
   HTTP call, the result travels through the host back to the iframe, and is visible in the GZAC
   case tab.

2. **`kv` — persistent view counter.** The existing `request("/summary", …)` handler is enhanced:
   on each invocation it reads `kv.get("view-count")`, increments, and writes
   `kv.set("view-count", count + 1)`. The count is returned in the response body and displayed in
   the case-tab iframe as "Tab views: N". This proves `kv` persists across invocations — refresh
   the tab and the counter increments. The counter is per-configuration, so two configurations of
   the same plugin have independent counts.

3. **`log` — structured logging visible in admin.** All existing `log.info(...)` calls are
   enhanced with a `data` parameter carrying structured context (e.g.
   `log.info("[case-summary] summary built", { documentId, summary, currency })`). The
   `request("/summary")` handler additionally logs at `debug` level with timing information. A
   new `log.warn(...)` call is added to the `countCases` handler when the upstream status is not
   200. These log entries appear in the admin log modal (§18.12), proving the structured logging
   pipeline works end-to-end.

**Case-tab frontend updates** (`frontend/case-tab.tsx`):

A new section/card is added to the case-tab UI:

- **"External API data"** — calls `sdk.getPluginData("/external-data")` and renders the todo
  item's title and completion status. Shows loading/error states matching the existing cards.
- **"Tab views"** — the view count from the `/summary` response is displayed as a small badge or
  counter in the "Plugin-served data" card header.

**Translation additions** (`manifest.json` translations):

```json
{
  "en": {
    "caseTab.external.title": "External API data",
    "caseTab.external.todoTitle": "Todo",
    "caseTab.external.todoCompleted": "Completed",
    "caseTab.external.error": "Could not load external data.",
    "caseTab.viewCount": "Tab views"
  },
  "nl": {
    "caseTab.external.title": "Externe API-gegevens",
    "caseTab.external.todoTitle": "Todo",
    "caseTab.external.todoCompleted": "Voltooid",
    "caseTab.external.error": "Kon externe gegevens niet laden.",
    "caseTab.viewCount": "Tabbladweergaven"
  }
}
```

### 18.14 Permission UX — capabilities section ⛔

The `PluginExternalPermissionsComponent` gains a third section above the existing two:

- **Host capabilities** — a `cds-structured-list` listing each declared capability with a
  localised name and description. The names and descriptions are static (not fetched from the
  backend like endpoint descriptions) — they are defined in the frontend translation bundle:

  | Capability | EN name | EN description |
  |-----------|---------|----------------|
  | `gzac_api` | GZAC API | Make authenticated calls to the GZAC REST API on behalf of the plugin or the logged-in user |
  | `http_request` | HTTP requests | Make outbound HTTP requests to external services |
  | `kv` | Key-value store | Read and write persistent key-value data scoped to this configuration |
  | `log` | Structured logging | Write structured log entries visible to administrators |

  Each row shows a tag with the capability name and the localised description.

- The existing single acknowledgement checkbox covers all three sections (capabilities, endpoints,
  events). The checkbox is required when **any** of the three sections has entries.

- In read-only mode (edit), all three sections are shown with the `acceptedNote` info notification.

**Create payload change.** The `POST .../configuration` body gains `grantedCapabilities: string[]`.
The frontend maps `manifest.permissions.capabilities` to the payload. The backend validates that
every manifest-declared capability is present (§18.2).

### 18.15 Verification plan

- Host `tsc` build clean with four host functions and the new DB repositories.
- Backend `:backend:external-plugin:test` — new test cases:
  - `ExternalPluginConfigurationServiceTest`: `create()` rejects when `grantedCapabilities` does
    not cover `manifest.permissions.capabilities`; `create()` persists granted capabilities;
    `update()` does not accept `grantedCapabilities`.
  - `ExternalPluginHostClientTest`: `pushConfiguration` body includes `grantedCapabilities`.
- Sample plugin `build:pack` clean — manifest includes `permissions.capabilities`.
- Frontend `@valtimo/plugin-management` `ng build` clean — permissions component renders the
  capabilities section; log modal compiles.
- End-to-end browser verification:
  - Configure the sample plugin with all four capabilities accepted.
  - Case tab renders: "External API data" card with todo from jsonplaceholder, view count
    incrementing on refresh, case counts (existing), and plugin-served data (existing).
  - Admin log modal shows structured log entries and API call logs for the configuration.
  - Reconfigure without `http_request` → the `/external-data` handler returns a capability-denied
    error, the card shows the error state.

## 19. Building-block process links ✅

External plugin actions are usable inside building-block processes with the same abstraction the
embedded plugin system uses: a link is either a **`FIXED`** reference (a concrete configuration
UUID) or a **`BUILDING_BLOCK`** reference (an abstract `pluginId@version`, resolved to a concrete
configuration per usage context at runtime).

**Reference model.** Both external link types embed the same `PluginConfigurationReference`
embeddable the embedded `PluginProcessLink` maps — shared `process_link` columns `reference_type`,
`plugin_definition_key` (= `pluginId`), and `plugin_definition_version` (external-only; embedded
rows keep it null because embedded definitions are unversioned). Two STI siblings mapping the same
embeddable columns is verified safe by `PluginConfigurationReferenceStiSpikeTest`
(`:backend:plugin`). The reference is **design-time metadata**: it drives validation, UI warnings,
and the import chooser (§20), while the runtime invocation always derives `pluginId` **and**
version from the resolved configuration's definition — a v1 action key can never be invoked
against a v2 configuration's token. Invariants (`ExternalPluginProcessLinkMapper`): `FIXED` ⇒
config id required (null only for a dangling import, §20), key/version derived from the
configuration at save time; `BUILDING_BLOCK` ⇒ config id null, key + version required from the
DTO.

**Runtime resolution (`ExternalPluginServiceTaskStartListener`).** A `BUILDING_BLOCK` reference is
resolved through the same optional `BuildingBlockPluginConfigurationResolver` SPI
(`backend/plugin`) the embedded `PluginService` uses — the building-block module's resolver walks
execution → `BuildingBlockInstance` → root instance → the call-activity's or case-definition
link's `pluginConfigurationMappings`. External entries share that one `Map<String, UUID>` under
the namespaced key **`external-plugin:<pluginId>@<version>`**, so embedded and external mappings
coexist without collision and version pinning stays strict (a block referencing two versions of
one plugin simply has two mapping rows). The listener validates the resolved configuration:
exists, definition `pluginId` matches the reference key, and the definition manifest still
declares the action key; a version mismatch proceeds on the resolved configuration's version with
a warning.

**Required-plugins surface.** `BuildingBlockPluginDefinitionService` /
`GET /api/management/v1/building-block/{key}/version/{versionTag}/plugin` also collect the
external `BUILDING_BLOCK` references from the block's process links (recursively through nested
blocks), returned with a `source: embedded|external` discriminator plus pluginId/version.

**Admin UX** (`@valtimo/process-link`). In building-block context the plugin picker
(`select-plugin-configuration`) lists external plugin **definitions** alongside embedded ones
(labels via `getExternalPluginDisplayName`, `Name (X.Y.Z)`); saving an external action in that
context writes a `BUILDING_BLOCK` reference (no configuration id). The call-activity /
case-definition mapping step (`configure-building-block-plugins`) renders a row per external
requirement with a dropdown of activated configurations — exact `pluginId@version` matches by
default, other versions of the same plugin selectable behind a non-blocking warning (the §11
compatibility-warning pattern) — and writes the namespaced key. Delete guards are unaffected:
`ExternalPluginHostUsageResolver` ignores links with a null configuration id, mirroring the
embedded rule that only fixed references block deletion.

## 20. Case-definition import/export parity ✅

Importing a case definition treats external plugin configurations exactly like embedded ones: the
import wizard shows every referenced configuration, the admin maps each to an existing
configuration in the target environment, unmapped references import as dangling and are repaired
later.

- **Export metadata.** `ExternalPluginProcessLinkExportResponseDto` /
  `ExternalPluginTaskFormProcessLinkExportResponseDto` carry `referenceType`,
  `pluginDefinitionKey`, and the version alongside the configuration id, so the target environment
  can list candidate configurations by `pluginId`.
- **Remap hook.** `ProcessLinkImporter` delegates configuration remapping per link type: each
  `ProcessLinkMapper` implements `applyPluginConfigurationMappings(node, mappings)` (the embedded
  mapper rewrites `pluginConfigurationId`; both external mappers rewrite
  `externalPluginConfigurationId`). One user-facing `Map<sourceUUID, targetUUID?>` covers both
  plugin systems — source UUIDs are unambiguous across them.
- **Preview.** `ExternalPluginImportPreviewContributor` (`backend/external-plugin/preview/`) scans
  `*.process-link.json` for `external_plugin` / `external_plugin_task_form` links **and**
  `*.case-tab.json` for `EXTERNAL_PLUGIN` tabs, emitting entries with `source: external`,
  pluginId, version, and an existence check. `PluginConfigurationPreviewDto` carries the
  `source: embedded|external` discriminator (default `embedded`).
- **Dangling handling.** An unmapped external link imports with a null configuration id; both
  external mappers' `afterImport` publish a `CaseConfigurationIssueDetectedEvent`
  (`external-plugin-process-link`). `ExternalPluginConfigurationMappingResolver` registers as an
  additional `PluginConfigurationMappingResolver` bean behind the existing
  `dangling-plugin-configurations` / `plugin-configuration-mappings` endpoints — no new endpoints.
- **`EXTERNAL_PLUGIN` case-tab import.** `CaseTabImporter` remaps the configuration UUID embedded
  in the tab's `contentKey` (`"<configId>[:<bundleKey>]"`) through the same mappings and creates
  the `case_external_plugin_tab` side row for imported tabs (the REST-driven create path derives
  the side row from `CaseTabCreatedEvent`, which a repository-level import does not fire — the
  importer therefore materialises it itself).
- **Wizard & repair UI** (`@valtimo/case-management`). The upload wizard's PLUGINS step and the
  missing-plugin-configurations repair component render external rows with options from
  `ExternalPluginService.getConfigurations()`, exact-version matches by default and
  version-mismatched candidates behind an explicit warning, labelled `Name (X.Y.Z)`.

## 21. Action result write-back ✅

A plugin action's result can be written declaratively to the case/building-block document or to
process variables through value-resolver expressions — for embedded **and** external plugin
actions, with no hand-coded `resultProcessVariable` action property needed.

- **Model.** `process_link.action_result_mappings` (json), mapped by both `PluginProcessLink` and
  `ExternalPluginProcessLink`; rows are `PluginActionResultMapping(source, target)` where `source`
  is an RFC 6901 JSON pointer into the action result (empty pointer = whole result) and `target`
  is a writable value-resolver key (`doc:`, `pv:`, `case:` — non-writable prefixes are rejected at
  save time by `PluginActionResultMappingValidator` in both mappers).
- **Dispatch (`PluginActionResultHandler`, `backend/plugin`).** Extracts each source pointer,
  splits `pv:` targets from document targets, and applies them via
  `ValueResolverService.handleValues` — the same pattern the building-block listeners use. Because
  `doc:` targets the execution's business-key document, a result written inside a building-block
  process lands on the **BB instance document** and BB output mappings carry it to the case as
  usual. Pointer misses and a null result with configured mappings log a warning; they never fail
  the process.
- **Embedded source.** `PluginService.invoke` (both overloads) captures the `@PluginAction`
  method's return value, serialises it, and delegates to the handler, so
  every listener (service task, user task, call activity, send/receive/intermediate events) is
  covered without listener changes.
- **External source.** The action output's optional `result` field (§7):
  `ExternalPluginServiceTaskStartListener` keeps applying `variables` as plain process variables
  and additionally feeds `body.result` through the handler. SDK `ActionOutput` declares `result`;
  the host passes it through verbatim; the `case-summary` sample action returns one.
- **Admin UX** (`@valtimo/process-link`). `PluginActionResultMappingsComponent` — an "Output
  mapping" section in the action-configuration step for both embedded and external actions:
  source/target rows with a free-text JSON-pointer input and a `ValuePathSelectorComponent` target
  (`doc:`/`case:` browsing with case/BB context; free-text `pv:` fallback for independent
  processes).

---

## Implementation status (§18)

Tracks what is done and what remains. No backward compatibility — still in dev.

### ✅ Done — plugin-host side (SDK + host app + sample plugin)

All compile clean (`tsc --noEmit` passes for SDK, host app, and sample plugin — the sample
plugin has one pre-existing TS error in the submit handler unrelated to capabilities).

**SDK (`plugin-sdk/`)**
- `models/types.ts` — `HOST_CAPABILITIES` const, `HostCapability` type, `capabilities` on
  `PluginManifest.permissions`, `HttpRequestResponse`, `KvGetResult` types.
- `models/index.ts` — re-exports new types + `HOST_CAPABILITIES` value.
- `manifest-validation.ts` — rejects unknown capabilities; flags `endpoints` without `gzac_api`.
- `host-functions.ts` — `log` accepts optional `data` arg, calls real Extism host function,
  added `debug` level.
- `kv.ts` (new) — `kv.get()`, `.set()`, `.delete()`, `.list()` via Extism host function.
- `http-request.ts` (new) — `httpRequest.get()`, `.post()`, `.put()`, `.delete()`.
- `index.ts` — exports `httpRequest`, `kv`, new types.

**Host app (`app/`)**
- `db/index.ts` — migration 3 (`granted_capabilities` column) + migration 4 (`plugin_kv` +
  `plugin_logs` tables with indexes).
- `db/kv-repository.ts` (new) — `get`, `set`, `delete`, `list`, `deleteAll`.
- `db/log-repository.ts` (new) — `insert`, `query` (paginated, filterable by level/source),
  `deleteOlderThan`, `deleteByConfiguration`.
- `db/config-repository.ts` — stores/reads `granted_capabilities` JSONB column.
- `models/plugin-configuration.ts` — `grantedCapabilities?: string[]` field.
- `host-functions/gzac-api.ts` — capability gate (`gzac_api`), `grantedCapabilities` on
  `GzacApiCallContext`.
- `host-functions/kv.ts` (new) — `kv` host function with capability gate, delegates to
  `KvRepository`.
- `host-functions/log.ts` (new) — `log` host function with capability gate, writes to pino +
  persists to `plugin_logs` (async, non-blocking).
- `host-functions/http-request.ts` (new) — `http_request` host function with capability gate,
  HTTPS-only default (`HOST_ALLOW_HTTP=true` for dev), blocks calls to `gzacBaseUrl`, timeout
  cap 60s, auto-logs to `plugin_logs`.
- `plugin-manager.ts` — registers all 4 host functions on `createPlugin`, new constructor
  params (`configRepository`, `kvRepository`, `logRepository`, `allowHttp`), private
  `resolveCapabilities()` helper, threads `grantedCapabilities` through every `hostContext`.
- `routes/plugin-logs.ts` (new) — `GET /api/host/configurations/:configId/logs` HMAC-signed,
  paginated, filterable by `level`/`source`.
- `index.ts` — wires `KvRepository`, `LogRepository`, `pluginLogRoutes`, log retention job
  (`LOG_RETENTION_DAYS` env, default 30, runs on startup + every 6h), clears interval on
  shutdown.

**Sample plugin (`case-summary/`)**
- `manifest.json` — `permissions.capabilities: ["gzac_api", "http_request", "kv", "log"]`,
  new `en`/`nl` translations for external-data and view-count UI sections.
- `src/plugin.ts` — KV view counter in `/summary`, new `/external-data` handler
  (JSONPlaceholder + KV + structured log), new `/kv-stats` handler, all existing `log.info()`
  calls updated to structured form with `data` parameter.

### ✅ Done — GZAC backend (Kotlin)

All compile clean (`compileKotlin` + `compileTestKotlin` + `test` pass).

1. **Domain** — `ExternalPluginGrantedCapability` entity.
2. **Repository** — `ExternalPluginGrantedCapabilityRepository`.
3. **Liquibase** — `20260716-external-plugin-granted-capability.xml` in `13-32-0/`.
4. **Service** — `ExternalPluginConfigurationService.create()`: add `grantedCapabilities`
   parameter, `validateGrantedCapabilitiesCoverManifest()` gate, persist to new table.
   `update()` does **not** accept `grantedCapabilities` (immutable after activation).
4. **Service** — `create()` accepts + validates + persists `grantedCapabilities`. `pushToHost()`
   includes them. `delete()` cleans them up. `getGrantedCapabilities()` query.
5. **Config push** — `pushToHost()` reads `grantedCapabilities` and passes to client.
   `ExternalPluginHostClient.pushConfiguration()` includes `grantedCapabilities` in body.
6. **REST DTO** — `ConfigurationCreateRequest` gains `grantedCapabilities`, new
   `GrantedCapabilityResponse`, `ConfigurationDetailResponse` includes capabilities.
7. **Management resource** — `createConfiguration` passes capabilities through,
   `getConfiguration` returns them.
8. **Host service** — `delete()` cleans up `grantedCapabilityRepository`.
9. **Autoconfiguration** — wired `grantedCapabilityRepository` into both services.
10. **Tests** — all 3 test files updated for new constructor param; all pass.

**Not yet done (backend):**
- Log proxy endpoint (`GET /api/management/v1/external-plugin/configuration/{configId}/logs`)
  that proxies the host's log route. Can be added later alongside the frontend log modal.

### ✅ Done — GZAC frontend (Angular)

All build clean (`ng build @valtimo/plugin` + `ng build @valtimo/plugin-management`).

1. **Permission UX** — `plugin-external-permissions` component: capabilities section added
   (structured list with purple `cds-tag` per capability + localised descriptions). Renders
   before endpoints. Checkbox condition includes capabilities. i18n added (en + nl) under
   `pluginManagement.permissions.capability.*`.
2. **Add modal** — `capabilities$` observable, `onCapabilitiesResolved`, `onGrantedCapabilitiesChange`,
   `grantedCapabilities` in save payload.
3. **Configure component** — `capabilitiesResolved` output, `setGrantedCapabilities`, `grantedCapabilities`
   in both save emit paths.
4. **Edit modal** — `_$capabilities` signal, wired through to readonly permissions component,
   `_$hasPermissionsStep` includes capabilities.
5. **Model** — `ExternalPluginPermissions.capabilities?: Array<string>`,
   `ExternalPluginConfigurationCreateRequest.grantedCapabilities`.

### ✅ Done — all remaining items

All builds pass: backend `compileKotlin` + `test`, host `tsc`, SDK `tsc`, frontend `ng build`.

6. **Tag colors** — permissions screen: capabilities = purple, HTTP methods = color-coded by
   verb (GET=blue, POST=green, PUT=teal, DELETE=red), endpoint patterns = cool-gray,
   events = teal.
7. **GZAC log proxy endpoint** — `GET .../configuration/{configId}/logs` proxies to host via
   HMAC. `ExternalPluginHostClient.getConfigurationLogs()`. Autoconfiguration wired.
8. **Admin log modal** — `PluginLogModalComponent` (standalone): `cds-modal size="lg"` with
   level/source filter dropdowns + `valtimo-carbon-list` (paginated) + row-click detail aside.
   Overflow menu "Logs" item on external configs. i18n (en + nl).
9. **Frontend service** — `ExternalPluginService.getConfigurationLogs()`.
10. **Frontend model** — `PluginLogEntry`, `PluginLogPage`.
11. **Sample plugin frontend** — case-tab: "External API data" card (JSONPlaceholder todo via
   `http_request`), per-document KV view counter badge, tab view count from `/summary`.
