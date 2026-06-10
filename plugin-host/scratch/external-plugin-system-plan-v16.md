# External Plugin System — Plan v16

External plugins extend the platform with sandboxed JS/TS backend logic (and iframe frontends)
without rebuilding the core app. A **definition** is a `pluginId@version` discovered on a host; a
definition may have multiple **configurations**, each with its own encrypted properties, granted
permissions, and a per-configuration service token. Hosted plugins run as `.wasm` modules in the
plugin host's Extism sandbox. Plugins can run **actions** (synchronous, invoked from a process
service task) and react to **events** (asynchronous, delivered from the core app's event stream).

Naming: prose says "core app" / "GZAC instance" / "host"; code identifiers keep their literal names
(`gzac`, `valtimo.*` properties, `external_plugin_*` tables, the `external_plugin_service` token
type).

Status legend: ✅ implemented & verified · 🟡 implemented, POC-level · ⛔ not implemented.

## 1. Components

| Area | Path | Status |
|------|------|--------|
| Core-app backend module | `backend/external-plugin/` | ✅ |
| Endpoint-description providers (per module) + contract | `backend/*/.../endpoint/*EndpointDescriptionProvider.kt`, `com.ritense.valtimo.contract.endpoint.EndpointDescriptionProvider` | ✅ |
| Plugin host (Node + Fastify + Extism, multi-version) | `plugin-host/app/` | 🟡 |
| Event consumer (RabbitMQ → `handle_event`) | `plugin-host/app/src/rabbitmq/event-consumer.ts` | 🟡 |
| Backend plugin SDK (`@valtimo/plugin-sdk`) — actions, events, `gzacApi` | `plugin-host/plugin-sdk/` | 🟡 |
| Sample plugin (action + event handler) | `plugin-host/sample-plugins/case-summary/` | ✅ |
| Frontend management UI + external models/service/iframe | `frontend/projects/valtimo/{plugin-management,plugin}/` | ✅ |
| Process-link (`SERVICE_TASK_START`) | `backend/external-plugin/.../processlink/` + frontend process-link | 🟡 |
| Plugin asset bundle (logo + i18n) | `plugin-host/plugin-sdk/` + `backend/external-plugin/.../asset/` | ⛔ |

Single-core-app model with **multiple hosts per instance**: the core app pushes each configuration
directly to its host with a freshly issued service token, a `gzacBaseUrl` callback target, and the
instance's `eventBroker` connection. Definitions are discovered by polling each host
(`GET /api/host/plugins`, default 60s) and stored with `UNIQUE(plugin_id, version)`.

## 2. Endpoint-scoped service token & permission enforcement ✅

A plugin gets a token scoped to exactly the API endpoints its configuration was granted, enforced
per-request with deny-by-default. The same token authenticates both action callbacks and event
callbacks.

**2.1 Activation stores grants (`service/ExternalPluginConfigurationService.kt`)**
- `create()` validates properties against the definition JSON schema, then
  `validateGrantedEndpointsCoverManifest()` **rejects the configuration unless every management
  endpoint declared in the manifest is granted** — permissions are all-or-nothing.
- Grants persist to `external_plugin_granted_endpoint` (`configuration_id`, `http_method`,
  `endpoint_pattern`); `update()` with non-null `grantedEndpoints` replaces them, null leaves them
  unchanged.

**2.2 Token (`service/ExternalPluginServiceTokenService.kt`)** — HS256 JWT:
`sub=external-plugin:{pluginId}:{configId}`, `type=external_plugin_service`, `plugin_config_id`,
`plugin_id`, `plugin_version`, `iss=valtimo-gzac`, `exp=now+24h`. **No roles.** Signed with
`valtimo.external-plugin.service-token-secret` (HMAC-SHA256, ≥32 bytes enforced by
`security/ExternalPluginServiceTokenKeyProvider.kt`).

**2.3 Recognition (`security/ExternalPluginServiceTokenFilter.kt`)** — registered **before**
`BearerTokenAuthenticationFilter` (`security/ExternalPluginCallbackHttpSecurityConfigurer.kt`,
`@Order(450)`): parses the bearer JWT with the plugin signing key; passes through if signature/`type`
don't match (Keycloak tokens untouched); on match sets an `ExternalPluginServicePrincipal`, **strips
the `Authorization` header**, and runs the rest of the chain inside
`AuthorizationContext.runWithoutAuthorization` (PBAC is intentionally bypassed for service tokens —
the allowlist is the sole gate).

**2.4 Enforcement (`security/ExternalPluginEndpointAllowlistFilter.kt`)** — registered **after**
`BearerTokenAuthenticationFilter`:
1. principal not `ExternalPluginServicePrincipal` → pass through (users/existing plugins unaffected);
2. request to `/api/management/v1/external-plugin/**` → 403 (a plugin can never reach its own mgmt API);
3. load grants for `plugin_config_id`, match request via `AntPathRequestMatcher(pattern, method)`;
   no match → 403; empty grants → deny.

**2.5 Host callback** — the host's `gzac_api` host function
(`plugin-host/app/src/host-functions/gzac-api.ts`) attaches the per-config `serviceToken` as
`Authorization: Bearer` to `${gzacBaseUrl}${path}`, forwarding method, JSON body, and headers. The
token is passed via Extism `hostContext`, never serialised into the Wasm input — plugin code never
sees it. This is the same mechanism for both action handlers and event handlers.

**2.6 Token lifecycle** — 24h TTL, **no separate refresh loop**. Each healthy discovery poll
re-pushes every configuration with a freshly issued token
(`service/ExternalPluginDiscoveryService.syncConfigurations()`), continuously replacing tokens well
inside their lifetime.

**2.7 Caveat** — service tokens bypass PBAC, so the allowlist is the entire authorization surface; an
over-broad grant (`/api/v1/**`) gives broad role-free access. Hence the activation-time acceptance
screen (§3) is security-critical.

## 3. Permission UX ✅

Components: `plugin-management/.../{plugin-external-permissions, plugin-add-modal,
plugin-external-edit-modal, plugin-external-configure}`. Endpoint descriptions are localised via
`POST /api/management/v1/external-plugin/endpoint-descriptions` (aggregated from every module's
`EndpointDescriptionProvider`; glob and `{param}` matching, `en`/`nl` with `en` fallback).

- **Add / activate**: select → configure (properties or config iframe) → **Permissions**. The
  permissions component shows a **read-only list** of all requested endpoints (method, pattern,
  description) plus one acknowledgement checkbox that gates Save. Accepting grants the full declared
  set. Save → `POST .../configuration` `{definitionId, title, properties, grantedEndpoints}`.
- **Edit**: same component with `[readonlyMode]="true"`; update sends `{title, properties}` only
  (grants immutable post-activation).
- Only `permissions.managementEndpoints` is modelled today; event subscriptions are declared by the
  plugin manifest and need no per-endpoint grant of their own, but any **callback** an event handler
  makes (e.g. writing a note) is gated by the management-endpoint grants exactly like an action.

## 4. Data model ✅

Tables (host secret and config properties stored encrypted via the existing `EncryptionService`):

- `external_plugin_host` — `base_url`, encrypted `secret`, `status`, health/failure counters.
- `external_plugin_definition` — `UNIQUE(plugin_id, version)`, `config_schema`, `manifest_json`,
  `host_id`, `base_url`, `status`. **The manifest's `eventSubscriptions` live here** (inside
  `manifest_json`), discovered from the host — there is no separate subscription table.
- `external_plugin_configuration` — `definition_id`, `title`, `properties` (encrypted on schema
  `x-secret` fields), `created_at`.
- `external_plugin_granted_endpoint` — `configuration_id`, `http_method`, `endpoint_pattern`,
  `granted_at`.
- `external_plugin_*` columns on `process_link` for the `SERVICE_TASK_START` action link.

Events add **no new table**: subscriptions come from `manifest_json`, and the broker connection is
pushed transiently with each configuration (it is held only in the host's in-memory registry, never
persisted on the host).

## 5. Plugin host 🟡 (`plugin-host/app/`, Node + Fastify + Extism)

Routes: `GET /health`; `*/api/host/plugins[...]` (ADMIN_TOKEN bearer); `*/api/host/configurations[...]`
(ADMIN_TOKEN; body requires `pluginId, pluginVersion, properties, serviceToken, gzacBaseUrl` and
optionally `eventBroker`); `POST|GET /plugins/:id/:version/actions/:key` and `/plugin-manifest`;
`GET /plugins/:id/:version/bundles/**`. Multi-version load keyed `pluginId@version`; configs held in
an in-memory registry. The only registered host function is `gzac_api`.

- **Action input**: `{actionKey, configurationId, configuration, processInstanceId, documentId,
  activityId, properties}`; output `{status, variables}`.
- **Plugins run under Extism with `runInWorker: true`** so async host functions (`gzac_api`) can
  suspend the Wasm call until the host's fetch resolves. **This requires Node ≥ 22** (older Node
  fails to spawn the worker with `invalid execArgv flags: --disable-warning`).
- **`DELETE /api/host/plugins/:pluginId/:version`** refuses removal with HTTP 409 if any active
  configurations on the host reference the plugin version
  (`configRegistry.listByPlugin(pluginId, version)`), returning the offending `configurationIds`.

Environment (`models/app-config.ts`): `ADMIN_TOKEN` (required), `PORT` (8090), `PLUGIN_STORAGE_DIR`
(`./plugins`), `LOG_LEVEL` (info), `HOST_ID` (defaults to the OS hostname; see §6). **No broker
variables** — the host never configures a broker itself.

Gaps to close for production: no `log` / `http_request` / `kv` host functions or
capability allowlist; no HTMX `render_page` / `handle_request`.

## 6. Events ✅ (POC-level 🟡)

End-to-end, an event the core app emits is delivered to every subscribed plugin configuration's
`handle_event`, which may call back into the core app. The host is **not** configured with a broker;
it learns each instance's broker from the configuration push, so one host serves many instances and
many hosts can serve one instance.

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

**6.1 Publish (core app).** Domain events extend `com.ritense.outbox.domain.BaseEvent` and are
serialized as CloudEvents v1.0 JSON by `CloudEventFactory`. `RabbitMessagePublisher` sends them with
`convertAndSend(exchange, routingKey, body)` where `exchange = valtimo-events` (from
`valtimo.outbox.publisher.rabbitmq.exchange`) and `routingKey` is empty. `valtimo-events` is a
**fanout, durable** exchange declared in `backend/app/gzac/imports/gzac-rabbitmq/definitions.json`
(also bound to the core app's `valtimo-audit` and `valtimo-inbox` queues). The wire shape:

```json
{
  "specversion": "1.0",
  "id": "…", "source": "com.ritense.gzac",
  "type": "com.ritense.valtimo.document.created",
  "time": "…", "datacontenttype": "application/json",
  "data": { "userId": "…", "roles": ["…"], "resultType": "…", "resultId": "…", "result": { } }
}
```

**6.2 Broker pushed by the core app, not configured on the host.** With every configuration push
(`POST/PUT /api/host/configurations/:id`) GZAC includes:

```json
"eventBroker": { "amqpUrl": "amqp://…@host:5672", "exchange": "valtimo-events", "exchangeType": "fanout" }
```

GZAC side: `ExternalPluginConfigurationService.pushToHost()` reads
`valtimo.external-plugin.event-broker.{amqp-url,exchange,exchange-type}` (defaults
`amqp://guest:guest@localhost:5672`, `valtimo-events`, `fanout`) and
`ExternalPluginHostClient.pushConfiguration()` serializes the `eventBroker` block — omitted when
`amqp-url` is blank, which disables events for that configuration (actions still work). `amqpUrl`
must be reachable **from the host**, which is not necessarily the address GZAC itself uses for
`spring.rabbitmq`.

**6.3 Consume (host, `rabbitmq/event-consumer.ts`).** `EventConsumerManager` keeps one
`BrokerConsumer` per **distinct broker** (`brokerKey = amqpUrl + exchange + exchangeType`). After any
configuration mutation the route calls `sync()` (serialized via a promise chain): it opens consumers
for newly referenced brokers and closes consumers no configuration references any more. A
`BrokerConsumer`:
- `assertExchange(exchange, exchangeType, { durable: true })`,
- `assertQueue("valtimo-external-plugins.<exchange>.<HOST_ID>", { durable: false, autoDelete: true })`,
- `bindQueue(queue, exchange, "")` (fanout ignores the routing key),
- `consume(..., { noAck: false })` — ack on success; a malformed message is `nack`-dropped (not
  requeued) to avoid a poison loop.
- On unexpected connection close it removes itself from the manager so the next `sync()` recreates it
  (there is no standalone reconnect loop — config pushes drive re-sync).

**6.4 Dispatch.** For each consumed CloudEvent the manager iterates the config registry and invokes
`handle_event` for every configuration that (a) carries the **same broker key** as the consuming
connection (so instance A's events never reach instance B's configs) **and** (b) whose
`manifest.eventSubscriptions` contains the CloudEvent `type`. The Wasm `EventInput` is the flattened
event (`type, id, source, time, userId, roles, resultType, resultId, result`) plus the
configuration's `properties`. `serviceToken` and `gzacBaseUrl` ride in the Extism per-call
`hostContext`, so an event handler's `gzac_api` callback is authenticated and allowlist-enforced
exactly like an action's.

**6.5 Multiple hosts per instance.** Because the exchange is a fanout and each host binds its **own**
queue (`valtimo-external-plugins.<exchange>.<HOST_ID>`, auto-deleted when the host disconnects):
- *Different* hosts on one instance have distinct queues → **every host receives a copy** of each
  event.
- *Replicas of the same host* (shared `HOST_ID`) bind the **same** queue and become competing
  consumers → each event is handled by **exactly one** replica. `HOST_ID` defaults to the OS
  hostname (so replicas are distinct unless a shared `HOST_ID` is set).
- Trade-off: the auto-delete queue is not retained while a host is fully down, so events published
  during that window are not delivered to it (live-subscription semantics).

**6.6 SDK & declaration.** A plugin declares the CloudEvent types it cares about in `manifest.json`:

```json
"eventSubscriptions": ["com.ritense.valtimo.document.created", "com.ritense.valtimo.task.completed"]
```

and registers a handler with `onEvent` (`plugin-sdk/src/events.ts`); the SDK runtime
(`plugin-sdk/src/runtime.ts`) exports `handle_event`, settling async handlers synchronously under
QuickJS (no event loop) and reporting `{status: "completed" | "ignored" | "error"}`. Multiple
handlers may register; all run per event.

**6.7 Worked example (sample plugin, `sample-plugins/case-summary`).** Subscribes to
`document.created`, `task.completed`, `document.viewed`. On `document.created` it writes a note back
to the document:

```ts
onEvent((event) => {
  if (event.type === "com.ritense.valtimo.document.created" && event.resultId) {
    const content = `consumed by external plugin on ${new Date().toISOString()}`;
    const res = gzacApi.post(`/api/v1/document/${event.resultId}/note`, { content });
    if (res.status < 200 || res.status >= 300) return { status: "error", errorCode: `NOTE_CREATE_${res.status}` };
  }
  return { status: "completed" };
});
```

For the callback to be authorized, the manifest declares the endpoint under
`permissions.managementEndpoints` (`POST /api/v1/document/*/note`); the configuration must be granted
it at activation, and the allowlist filter (§2.4) permits the bearer-token call.

**6.8 Event-type catalog.** CloudEvent `type` strings are matched verbatim. Notable ones:
`com.ritense.valtimo.document.{created,updated,viewed,deleted,assigned,unassigned,status.changed,...}`,
`com.ritense.valtimo.task.{completed,assigned,unassigned,dueDateSet}`,
`com.ritense.valtimo.note.{created,updated,deleted,viewed,listed}`,
`com.ritense.valtimo.case.configuration-issue.updated`. (Defined as `TYPE` constants /
constructor args on the `BaseEvent` subclasses in `backend/{case,core,notes}/…/event/`.)

## 7. SDK & developer experience 🟡

A plugin author writes `src/plugin.ts`: import `{action, onEvent, config, gzacApi, log}` from
`@valtimo/plugin-sdk`; `action("key", (input) => ({status, variables}))`; `onEvent((event) => …)`;
read config via synchronous `config.get()`; call `gzacApi.{get,post,put,delete}()` (synchronous from
the plugin's view — the host suspends the call). Build: `valtimo-plugin-build` (esbuild → `extism-js`)
then `valtimo-plugin-pack` (zip of `manifest.json` + `plugin.wasm` + `frontend/`).

DX done: the build auto-generates the Wasm interface (`handle_action` + `handle_event` exports +
`gzac_api` import) so authors write only `src/plugin.ts`; the runtime settles returned promises and
never serialises a pending `Promise`; the pack copies `manifest.json` verbatim so `eventSubscriptions`
and `permissions` carry through.

`PluginManifest` is defined once in `@valtimo/plugin-sdk/src/models/types.ts`; the host app's
`models/plugin-manifest.ts` re-exports from the SDK so there is a single source of truth.

Remaining DX: align all docs/examples on one (synchronous) calling convention; add
`onRequest` / `renderPage` for HTMX pages.

## 8. Deletion semantics & cascade ⛔ (to do — partial guards in place)

The entity chain is:

```
Host
 └─ Definition (pluginId@version, discovered)
     └─ Configuration (activated; encrypted properties + granted endpoints)
         ├─ GrantedEndpoint (many)
         └─ ProcessLink (references config + activity in a BPMN model)
```

**Current state:**
- `DELETE /api/host/plugins/:id/:version` on the host (§5) refuses with **409 Conflict** if active
  configurations exist on the host. ✅
- `ExternalPluginConfigurationService.delete()` cascades `granted_endpoint` rows and calls the host
  to drop the configuration in-memory. **Does not check process links.** 🟡
- `ExternalPluginHostService.delete()` cascades definitions, configurations, and grants. **Does not
  check process links.** 🟡

**Target deletion contract (to do):**

| Entity | Refuse when… | Behaviour | Override |
|--------|--------------|-----------|----------|
| **ProcessLink** | never | user unlinks from BPMN | — |
| **Configuration** | a ProcessLink references it | 409 + list of `(processDefinitionId, activityId)` | `?force=true` deletes links too (admin) |
| **Definition** | a Configuration exists for it | implicit (no direct UI delete; removed when host syncs and the version disappears upstream AND no configs remain) | — |
| **Host** | any Configuration exists under any Definition on this host | 409 + count of configurations and definitions | `?force=true` cascades everything (admin) |
| **Plugin on host** (host-side route) | active config refers to plugin version | 409 + `configurationIds` ✅ | — (must remove configs first via GZAC) |

UX: each refusal returns a structured body the UI uses to render a "what depends on this" list with
deep links (configuration page, BPMN diagram). The default is **strict**; `force=true` is an admin
override that performs the cascade in a single transaction and logs an audit event.

Discovery cleanup: when a definition disappears upstream (host no longer lists it), `consecutiveMisses`
increments per poll. After **N** misses (configurable, default 3) the definition is marked
`MISSING` rather than deleted; deletion is admin-driven once configurations are also removed.

## 9. Multi-version support 🟡 (coexistence ✅, upgrade ⛔ to do)

**9.1 What works today.** The data model is multi-version capable:
- `external_plugin_definition` has `UNIQUE(plugin_id, version)` so v1 and v2 of the same plugin
  coexist as separate rows.
- The host loads each `(pluginId, version)` as a distinct Wasm module.
- A `Configuration` references one specific `definition_id` → pinned to one version.
- A `ProcessLink` carries an explicit `pluginVersion` column → pinned to one version transitively
  (denormalised but deterministic).

Operator flow for v1 → v2 (no in-place upgrade):
1. Plugin author publishes v2 to the host alongside v1.
2. GZAC discovers both versions.
3. Admin activates a **new v2 configuration** (parallel to v1).
4. Admin updates each BPMN process link to point at the v2 configuration.
5. Admin deletes the v1 configuration; v1 definition can then be removed (per §8).

**9.2 What's missing (to do):**

- **Configuration migration**: properties for v1 may not validate against v2's schema. Need either
  (a) a per-plugin migration script the SDK calls during activation of the upgrade, or (b) an
  "upgrade to v2" UI that diffs the schemas and asks the operator to fill in any new required
  fields, with defaults pre-populated from v1.
- **Permission diff on upgrade**: if v2 requests an endpoint v1 did not, the upgrade flow must
  re-prompt for acceptance (analogous to the activation screen, scoped to the delta).
- **Process-link upgrade**: today every BPMN service task carries `external_plugin_version`. An
  in-place "upgrade configuration to v2" must rewrite affected process links, or — preferably — drop
  the `pluginVersion` column from `process_link` and resolve the version transitively through the
  configuration. That's a schema change worth taking when the upgrade flow lands.
- **Version status / channel**: add `ExternalPluginDefinitionStatus.{LATEST, STABLE, DEPRECATED}` so
  the activation screen can guide operators toward the recommended version and show a warning for
  deprecated ones. New configurations on a `DEPRECATED` version are blocked; existing ones keep
  working.
- **Default version policy**: when the operator clicks "Add" on a pluginId with multiple versions
  available, surface them all and default to the highest-non-deprecated semver.

Constraint compatibility (`compatibility.{minGzacVersion, maxGzacVersion}` already in the manifest
and persisted on the definition) is currently descriptive — it's stored but not enforced at
activation time. Part of the upgrade-UX work is to refuse activation when the running GZAC is
outside the declared compatibility range.

## 10. Logos and translations shipped with plugins ⛔ (to do)

Plugins need a visual identity (logo on the management screen, on the process-link picker, on the
case widget) and localised strings (action titles, configuration field labels, permission
descriptions). Both should ship with the plugin package so the operator doesn't need to copy assets
into the core app.

**10.1 Package layout (new SDK convention):**

```
my-plugin.zip
├── manifest.json
├── plugin.wasm
├── frontend/           (existing — config iframe, action UIs, etc.)
├── assets/
│   ├── logo.svg                (preferred; one SVG ≤ 32 KB)
│   └── logo@2x.png             (fallback; max 256×256 px)
└── i18n/
    ├── en.json                 (required; canonical)
    ├── nl.json
    └── …                       (one file per locale)
```

`manifest.json` gains an `assets` block declaring what's shipped:

```json
"assets": {
  "logo": "assets/logo.svg",
  "i18n": { "en": "i18n/en.json", "nl": "i18n/nl.json" }
}
```

**10.2 Translation key conventions.** Locale files are flat JSON of `key → translation`. To avoid
collisions, **all keys are namespaced** `externalPlugin.<pluginId>.<key>`. The SDK pack step verifies
the prefix at build time and rejects unprefixed keys. Recommended keys:

```json
{
  "externalPlugin.case-summary.name": "Case Summary",
  "externalPlugin.case-summary.description": "Summarises case content",
  "externalPlugin.case-summary.action.summarize.title": "Summarise case",
  "externalPlugin.case-summary.config.openAiKey.label": "OpenAI API key",
  "externalPlugin.case-summary.permission.notes.write": "Write notes back to the case"
}
```

`manifest.json` text fields (`name`, `description`, `actions[].title`, `permissions.managementEndpoints[].description`)
support a `{{ i18n:<key> }}` template syntax; the management UI resolves these against the shipped
bundle at render time, with the un-templated raw string as fallback for unknown locales.

**10.3 Host side.** The host serves both via the existing bundle route, namespaced under `assets/`:

```
GET  /plugins/:id/:version/assets/logo            → 200 image/svg+xml  (or 404 if absent)
GET  /plugins/:id/:version/assets/i18n/:locale    → 200 application/json (locale or `en` fallback)
GET  /plugins/:id/:version/assets/i18n            → 200 list of available locales
```

These routes are **anonymous** (no ADMIN_TOKEN) for the same reason `bundles/**` is — they're
referenced from the GZAC management UI as URLs. Cache-Control: `public, max-age=300`.

**10.4 Core app side.**
- Discovery (`ExternalPluginDiscoveryService`) reads `manifest.assets` and persists the available
  locales on `external_plugin_definition` (new column `i18n_locales TEXT[]`).
- A new endpoint `GET /api/management/v1/external-plugin/definitions/:id/i18n/:locale` proxies the
  host's i18n file (so the frontend doesn't need to know the host URL).
- `ExternalPluginTranslationService` (new) loads each active configuration's bundle into the
  `localization` module's runtime resource bundle at activation time, with the same `en` fallback as
  built-in modules. Cache TTL ≈ 5 minutes; invalidated on configuration mutation.
- The frontend's `TranslateService` is fed via the existing `MULTI_TRANSLATE_LOADER` token — we add
  one provider that issues a single `GET .../i18n/{lang}` per active definition.

**10.5 UI surfaces** that pick up the new assets:
- `plugin-management` list and detail header: shows `logo` next to the plugin name.
- `plugin-add-modal`: shows logo and translated description.
- `plugin-external-permissions`: each `managementEndpoints[].description` resolves through the
  plugin's bundle.
- Process-link picker (when adding an external plugin action to a service task): logo + translated
  action title.

**10.6 Constraints.**
- Logo ≤ 32 KB SVG / 256×256 PNG, validated at upload.
- i18n bundle ≤ 64 KB per locale, validated at upload.
- Keys outside the `externalPlugin.<pluginId>.` namespace are stripped during ingestion (not just
  rejected at build), as defence in depth against key collisions with core translations.

## 11. Not yet implemented ⛔

Host capabilities + host functions (`http_request`, `kv`, structured `log`) with allowlist
enforcement; downscoped user tokens for iframe→user-endpoint calls (PBAC ∩ allowlist); HTMX pages;
case tabs/widgets; menu pages; host database (KV, API logs, retention); URL-plugin mode;
broker credential delivery over TLS/HMAC rather than the admin-token channel;
event delivery durability across host downtime (currently live-subscription only);
plugin asset bundle (logos + i18n, §10);
multi-version upgrade flow (§9.2);
full deletion-cascade contract with `force=true` admin override (§8).

## 12. Roadmap (priority order)

1. ~~Authenticate the host action route (service token + HMAC) — security blocker.~~ ✅ Implemented:
   `plugin-host/app/src/security/hmac.ts` + preHandler on action route. HMAC-SHA256 over
   `{METHOD}\n{path}\n{timestamp}\n{bodyHash}` using `ADMIN_TOKEN` as shared secret; 5-minute
   timestamp drift tolerance; timing-safe comparison.
2. ~~Refuse plugin deletion on host while active configs reference it.~~ ✅
3. ~~De-duplicate `PluginManifest` type between host app and SDK.~~ ✅
4. **Deletion cascade & guards (§8)** — block configuration delete when process links exist; block
   host delete when configurations exist; add `?force=true` admin override; structured 409 bodies for
   the UI dependency-list. ⛔
5. **Plugin assets — logo + i18n (§10)** — SDK package layout, host serving routes, core-app
   discovery + proxy + translation merge, UI surfaces. ⛔
6. **Multi-version upgrade UX (§9.2)** — version status (`LATEST/STABLE/DEPRECATED`), compatibility
   enforcement, schema-diff & permission-diff upgrade flow, drop denormalised `pluginVersion` from
   `process_link` in favour of transitive resolution. ⛔
7. Capabilities + host functions + allowlist enforcement; surface in the acceptance screen by
   category.
8. Durable/replayable event delivery option (per-host durable queue with TTL) for hosts that must not
   miss events during downtime.
9. Downscoped user tokens.
10. HTMX pages, case tabs/widgets, menu pages.
11. Host database (KV, API logs, retention) + admin log view.
12. Cleanup: align async-vs-sync SDK docs.

## 13. Verification status

- Host `tsc` build and `@valtimo/plugin-sdk` build: clean.
- Backend `:backend:external-plugin:test`: BUILD SUCCESSFUL (allowlist + service-token-filter +
  endpoint-description-provider tests).
- Frontend `ng build` (production): clean.
- Sample plugin `build`: clean (Wasm + pack).
- Events, end-to-end against the live `gzac-rabbitmq` broker (sample plugin):
  - config push with `eventBroker` opens one broker consumer; subscribed types
    (`document.viewed`, `task.completed`, `document.created`) invoke `handle_event` → `completed`;
    an unsubscribed type (`note.created`) is **not** delivered.
  - `document.created` → `gzac_api` issues `POST /api/v1/document/<id>/note` with the service-token
    bearer and body `{"content":"consumed by external plugin on <ISO date>"}` (verified against a
    stub on the `gzacBaseUrl`).
  - **Multiple hosts per instance**: two hosts with distinct `HOST_ID` each bind their own queue and
    both handle a single published event (two note POSTs); a replica with a shared `HOST_ID` joins
    the existing queue (no new queue) and the group handles each event once.
  - deleting the last configuration on a broker tears the consumer down (queue auto-deletes).
- Not run here: full `:backend:app:gzac:bootRun` event→note persistence and the ungranted-callback
  403 path (the allowlist filter is code-traced in §2.4); full Angular app build.
