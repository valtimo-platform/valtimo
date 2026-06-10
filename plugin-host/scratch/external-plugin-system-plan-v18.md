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
| Sample plugin (action + event handler + logo + i18n) | `plugin-host/sample-plugins/case-summary/` | ✅ |
| Frontend management UI + external models/service/iframe | `frontend/projects/valtimo/{plugin-management,plugin}/` | ✅ |
| Process-link (`SERVICE_TASK_START`) | `backend/external-plugin/.../processlink/` + frontend process-link | 🟡 |
| Per-host broker / callback config + defaults endpoint | `backend/external-plugin/.../web/rest/ExternalPluginManagementResource.kt#hostDefaults` | ✅ |
| Plugin assets (logo + i18n bundle in manifest, served by host) | `plugin-host/plugin-sdk/bin/valtimo-plugin-pack.mjs`, `plugin-host/app/src/routes/plugin-bundles.ts` | ✅ |

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
| Broker AMQP URL per push | `external_plugin_host.event_broker_amqp_url` (nullable) | Set in the add-host UI; default pre-fill built from `spring.rabbitmq.*`. Null disables events for hosts under this host (actions still work). |
| Broker exchange per push | `external_plugin_host.event_broker_exchange`, else `valtimo.outbox.publisher.rabbitmq.exchange` | Set in the add-host UI; default pre-fill from the outbox exchange, which is what GZAC itself publishes to. |
| Broker exchange type | hardcoded `fanout` | Matches the outbox publisher and the exchange declared in `imports/gzac-rabbitmq/definitions.json`. |

`git diff next-minor -- backend/app/gzac/src/main/resources/application.yml` is empty.

## 3. Endpoint-scoped service token & permission enforcement ✅

A plugin gets a token scoped to exactly the API endpoints its configuration was granted, enforced
per-request with deny-by-default. The same token authenticates both action callbacks and event
callbacks.

**3.1 Activation stores grants (`service/ExternalPluginConfigurationService.kt`)**
- `create()` validates properties against the definition JSON schema, then
  `validateGrantedEndpointsCoverManifest()` **rejects the configuration unless every endpoint
  declared in the manifest is granted** — permissions are all-or-nothing.
- Grants persist to `external_plugin_granted_endpoint` (`configuration_id`, `http_method`,
  `endpoint_pattern`); `update()` with non-null `grantedEndpoints` replaces them, null leaves them
  unchanged.

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

**3.8 Manifest field rename ⛔.** The manifest currently calls the endpoint allowlist
`permissions.managementEndpoints`. This is too narrow a name — these same endpoints will also be
used by iframe-driven user-token calls (§13). The intended rename is
`permissions.endpoints` (one declaration consumed by both the service-token and user-token
authorization paths). Carries through to the Kotlin DTO, the frontend model, the
endpoint-description endpoint, and the manifest itself in every sample plugin.

## 4. Permission UX ✅ (with one ⛔ extension)

Components: `plugin-management/.../{plugin-external-permissions, plugin-add-modal,
plugin-external-edit-modal, plugin-external-configure}`. Endpoint descriptions are localised via
`POST /api/management/v1/external-plugin/endpoint-descriptions` (aggregated from every module's
`EndpointDescriptionProvider`; glob and `{param}` matching, `en`/`nl` with `en` fallback).

- **Add / activate**: select → configure (properties or config iframe) → **Permissions**. The
  permissions component shows a **read-only list** of all requested endpoints (method, pattern,
  description) plus one acknowledgement checkbox that gates Save. Accepting grants the full
  declared set. Save → `POST .../configuration` `{definitionId, title, properties, grantedEndpoints}`.
- **Edit**: same component with `[readonlyMode]="true"`; update sends `{title, properties}` only
  (grants immutable post-activation).

**⛔ Event-subscription disclosure.** Today the permission screen only lists endpoint grants. The
plugin's `eventSubscriptions` (which CloudEvent types the host's plugin will receive at
`handle_event`) are equally a permission decision — they let the plugin observe domain activity it
would otherwise need polling for. The screen needs a second read-only section under
"Permissions" listing the subscribed event types with localised descriptions. Enforcement stays on
the host (only types declared in the manifest are dispatched), so this is UX disclosure rather
than a new authorization gate.

## 5. Data model ✅

Tables (host secret and config properties stored encrypted via the existing `EncryptionService`):

- `external_plugin_host` — `base_url`, encrypted `secret`, `status`, health/failure counters,
  **plus** `gzac_callback_base_url`, `event_broker_amqp_url`, `event_broker_exchange` (all
  populated from the add-host UI; the two broker columns nullable for events-off / use-default-exchange).
- `external_plugin_definition` — `UNIQUE(plugin_id, version)`, `config_schema`, `manifest_json`,
  `host_id`, `base_url`, `status`. **The manifest's `eventSubscriptions` live here** (inside
  `manifest_json`), discovered from the host — there is no separate subscription table.
- `external_plugin_configuration` — `definition_id`, `title`, `properties` (encrypted on schema
  `x-secret` fields), `created_at`.
- `external_plugin_granted_endpoint` — `configuration_id`, `http_method`, `endpoint_pattern`,
  `granted_at`.
- `external_plugin_*` columns on `process_link` for the `SERVICE_TASK_START` action link.

Events add **no new table**: subscriptions come from `manifest_json`, the broker connection
details come from the host row, and at push time they are pushed transiently to the host (held
only in the host's in-memory registry until the host stores them in its own PostgreSQL).

## 6. Adding a host & host-defaults endpoint ✅

`GET /api/management/v1/external-plugin/host-defaults` (`ExternalPluginManagementResource`)
returns three pre-fills the add-host UI uses to populate the new-host form:

```json
{
  "gzacCallbackBaseUrl": "http://localhost:8080",
  "eventBrokerAmqpUrl": "amqp://guest:guest@localhost:5672",
  "eventBrokerExchange": "valtimo-events"
}
```

The operator edits whatever does not match the host's network. Three fields are exposed:
`gzacCallbackBaseUrl` is required; `eventBrokerAmqpUrl` and `eventBrokerExchange` are optional.
Leaving the broker URL blank disables events for every configuration under this host.

`ExternalPluginHostService.register()` trims trailing `/` on the URLs, encrypts the secret,
blanks become `null`.

## 7. Plugin host 🟡 (`plugin-host/app/`, Node + Fastify + Extism)

Routes: `GET /health`; `*/api/host/plugins[...]` (ADMIN_TOKEN bearer);
`*/api/host/configurations[...]` (ADMIN_TOKEN; body requires `pluginId, pluginVersion, properties,
serviceToken, gzacBaseUrl` and optionally `eventBroker`); `POST|GET /plugins/:id/:version/actions/:key`,
`/plugin-manifest`, `/logo`; `GET /plugins/:id/:version/bundles/**`. Multi-version load keyed
`pluginId@version`; configs held in an in-memory registry **and persisted to PostgreSQL**. The
only registered host function is `gzac_api`.

- **Action input**: `{actionKey, configurationId, configuration, processInstanceId, documentId,
  activityId, properties}`; output `{status, variables}`.
- **Plugins run under Extism with `runInWorker: true`** so async host functions (`gzac_api`) can
  suspend the Wasm call until the host's fetch resolves. **This requires Node ≥ 22** (older Node
  fails to spawn the worker with `invalid execArgv flags: --disable-warning`).
- **`DELETE /api/host/plugins/:pluginId/:version`** refuses removal with HTTP 409 if any active
  configurations on the host reference the plugin version
  (`configRegistry.listByPlugin(pluginId, version)`), returning the offending `configurationIds`.

Environment (`models/app-config.ts`): `ADMIN_TOKEN` (required), `PORT` (8090),
`PLUGIN_STORAGE_DIR` (`./plugins`), `LOG_LEVEL` (info), `HOST_ID` (defaults to the OS hostname;
see §8.4), plus `DB_HOST/PORT/NAME/USER/PASSWORD` for the host's PostgreSQL. **No broker
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

### 8.2 Per-host broker, learned at config push time

The plugin host is **not** configured with a broker URL via env variables. It learns each
configuration's broker from the GZAC push, so one host can serve many GZAC instances and many
hosts can serve one instance.

`ExternalPluginConfigurationService.pushToHost(config, definition, host)` reads the broker fields
off the host row, with `host.eventBrokerExchange` falling back to the outbox exchange when null
and `exchangeType` hardcoded `fanout`. `eventBrokerAmqpUrl` being null causes the entire
`eventBroker` block to be omitted from the push body — actions still work, events don't.

### 8.3 Consume (host, `rabbitmq/event-consumer.ts`)

`EventConsumerManager` keeps one `BrokerConsumer` per **distinct broker**
(`brokerKey = amqpUrl + exchange + exchangeType`). After any configuration mutation the route
calls `sync()` (serialised via a promise chain): it opens consumers for newly referenced brokers
and closes consumers no configuration references any more. A `BrokerConsumer`:
- `assertExchange(exchange, exchangeType, { durable: true })`,
- `assertQueue("valtimo-external-plugins.<exchange>.<HOST_ID>", { durable: false, autoDelete: true })`,
- `bindQueue(queue, exchange, "")` (fanout ignores the routing key),
- `consume(..., { noAck: false })` — ack on success; a malformed message is `nack`-dropped (not
  requeued) to avoid a poison loop.

Restart behaviour: configs are persisted in the host's PostgreSQL (`plugin_configurations` table).
On boot the host calls `eventConsumerManager.sync()` which re-opens consumers for every config
that still carries an `eventBroker.amqpUrl`. Expect a `"Broker consumer started"` log line at
startup if any persisted configs reference a broker, even before GZAC sends a fresh push.

### 8.4 Dispatch & multi-host topologies

For each consumed CloudEvent the manager iterates the config registry and invokes `handle_event`
for every configuration that (a) carries the **same broker key** as the consuming connection (so
instance A's events never reach instance B's configs) **and** (b) whose
`manifest.eventSubscriptions` contains the CloudEvent `type`. The Wasm `EventInput` is the
flattened event (`type, id, source, time, userId, roles, resultType, resultId, result`) plus the
configuration's `properties`. `serviceToken` and `gzacBaseUrl` ride in the Extism per-call
`hostContext`, so an event handler's `gzac_api` callback is authenticated and allowlist-enforced
exactly like an action's.

Multi-host topologies:
- *Different* hosts on one GZAC instance have distinct queues → **every host receives a copy** of
  each event.
- *Replicas of the same host* (shared `HOST_ID`) bind the **same** queue and become competing
  consumers → each event is handled by **exactly one** replica.
- *One host serving multiple GZAC instances*: each instance has its own broker, so the host opens
  a separate `BrokerConsumer` per broker. Dispatch only fires configurations whose pushed broker
  key matches the consuming connection.
- Trade-off: the auto-delete queue is not retained while a host is fully down, so events
  published during that window are not delivered to it (live-subscription semantics).

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
`models/plugin-manifest.ts` re-exports from the SDK so there is a single source of truth.

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

**CSP.** The main app's CSP `<meta>` tag is augmented at boot
(`projects/valtimo/security/.../initialize-csp.ts`) with the discovered host origins on both
`frame-src` (iframe loading) **and** `img-src` (logo loading). The bootstrap fetches
`/api/management/v1/external-plugin/host` and passes the origins into the initializer; without
this, `<img src="http://plugin-host:8090/.../logo">` is blocked by `img-src 'self' data:`.

## 11. Multi-version support 🟡 (coexistence ✅, in-place upgrade ⛔)

**Why coexistence matters.** Once a case definition becomes *final*, its BPMN — including any
service tasks bound to an external-plugin action — is immutable. A process link cannot then be
edited, and therefore cannot be moved to a newer version of the same plugin. New work happens on
a new case definition, which is free to bind to a newer plugin version. This means **multiple
versions of the same plugin must run side-by-side indefinitely**: there is no path of
"deprecating" an old version while final case definitions still reference it.

**What works today.**
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

**⛔ Version visibility in the UI.** The version number is currently absent from most surfaces.
It needs to appear:
- In the "Configure plugin" modal (plugin tile shows `Name vX.Y.Z` and the description)
- In the configurations overview list (extra column or suffix on the configuration title)
- In the process-link configuration picker (so the BPMN author knows which version they're binding
  to)
- In the configuration edit modal header

**⛔ Other gaps.** Schema migration for an in-place v1 → v2 configuration "upgrade" is not
implemented and arguably unnecessary given the side-by-side model. Permission-diff prompts,
compatibility-range enforcement (`compatibility.minGzacVersion` / `maxGzacVersion` are stored but
not enforced at activation), and a `LATEST/STABLE/DEPRECATED` channel status are all open.

## 12. Deletion semantics — strict, never forced ⛔ (host-side plugin delete ✅)

Deletion of a host or a plugin configuration is **never allowed** while any process link in the
system references that configuration — even when the case definition that owns the BPMN is final
and the link is therefore frozen.

Rationale: a forced cascade would silently break a final case definition's runtime behaviour. The
configuration is immutable for the same reason the BPMN that references it is immutable. The user
experience is to surface what depends on the resource and explain that deletion is unavailable.

| Entity | Blocked when… | Surface |
|--------|---------------|---------|
| **ProcessLink** | never (BPMN authoring is the source of truth — the case definition is the gate) | — |
| **Configuration** | any `ProcessLink` references it | Edit/delete screen shows a panel: "Cannot delete: used by N process link(s)" with `(processDefinitionKey, activityName, caseDefinitionKey, version)` deep links. No override. |
| **Definition** | any `Configuration` exists for it | Not directly user-deletable; cleared by the discovery cycle when the upstream host no longer lists the version **and** no configurations remain. |
| **Host** | any `Configuration` under any definition on this host has at least one `ProcessLink` referencing it | Host detail screen shows the same dependency panel. Deletion of an entire host with active configurations remains blocked: removing the host would orphan service tokens, push paths, and broker bindings for live configurations. |
| **Plugin on host** (host-side route) ✅ | active config refers to plugin version | `DELETE /api/host/plugins/:id/:version` returns HTTP 409 with `configurationIds`. |

A configuration that *has* been activated but has no process links yet **can** be deleted (it is
not yet load-bearing). A host without any configurations can be deleted. Discovery cleanup
continues to mark missing definitions `UNAVAILABLE` after N consecutive misses
(`failure-threshold`, default 3) rather than deleting them.

UX detail: the dependency-list endpoint returns enough context for the UI to render a clickable
list — process definition key, activity name, case definition key + version, last process
instance count — so the operator can take action (close out the case definition, archive
instances) before retrying.

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
- User-token-scoped endpoints (§13) — including the manifest rename
  `managementEndpoints` → `endpoints` (§3.8).
- Event-subscription disclosure in the activation permission screen (§4).
- Version display across all UI surfaces (§11).
- Strict deletion guards for host and configuration when process links exist (§12) — currently
  only the host's plugin-delete route enforces this.
- Host database for KV / API logs / retention.
- URL-plugin mode.
- Broker credential delivery over TLS/HMAC rather than the admin-token channel.
- Event delivery durability across host downtime (currently live-subscription only).

## 15. Roadmap (priority order)

1. **Strict deletion guards (§12)** — block configuration delete and host delete when any
   process link exists; structured "what depends on this" body for the UI dependency panel; no
   force override.
2. **Version visibility (§11)** — surface `pluginId@version` on the configure-plugin tile, in
   the configurations list, in the process-link picker, and in the edit modal header.
3. **Event-subscription disclosure (§4)** — extend the activation permissions screen with a
   read-only event-types section.
4. **Manifest rename `managementEndpoints` → `endpoints` (§3.8)** — single edit pass across
   `PluginManifest` SDK type, host app type, backend grant validation, frontend model,
   endpoint-description-resolver, every sample plugin's manifest. Keep `managementEndpoints` as a
   read fallback for one minor release for any in-flight external plugins.
5. **User-token-scoped endpoints (§13)** — new `POST /user-token` endpoint, user-token filter
   with PBAC ∩ allowlist intersection, frontend wiring in `ExternalPluginIframeComponent.onIframeLoad()`
   to populate `accessToken` from `/user-token`, SDK side already exposes `getAccessToken()`.
6. Capabilities + host functions + allowlist enforcement; surface in the acceptance screen by
   category.
7. Durable / replayable event delivery option (per-host durable queue with TTL) for hosts that
   must not miss events during downtime.
8. HTMX pages, case tabs, case widgets, menu pages.
9. Host database (KV, API logs, retention) + admin log view.
10. Cleanup: align async-vs-sync SDK docs.

## 16. Verification status

- Host `tsc` build and `@valtimo/plugin-sdk` build: clean.
- Backend `:backend:external-plugin:test`: BUILD SUCCESSFUL (allowlist + service-token-filter +
  endpoint-description-provider tests, 25 cases).
- Backend `:backend:app:gzac:compileKotlin`: BUILD SUCCESSFUL.
- Frontend `ng build` (production): clean.
- Sample plugin `build:pack`: clean (Wasm + pack including `logo.svg` and `translations.en/nl`).
- `git diff next-minor -- backend/app/gzac/src/main/resources/application.yml`: empty (no
  application.yml additions over `next-minor`).
- Events, end-to-end against the live `gzac-rabbitmq` broker (sample plugin):
  - host startup re-opens consumers from persisted configs ("Broker consumer started" log on
    boot is expected when a previous push is in the host's PostgreSQL);
  - config push with `eventBroker` opens one broker consumer; subscribed types
    (`document.viewed`, `task.completed`, `document.created`) invoke `handle_event` → `completed`;
    unsubscribed types are not delivered;
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
