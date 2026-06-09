# External Plugin System — Plan v15

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

Environment (`models/app-config.ts`): `ADMIN_TOKEN` (required), `PORT` (8090), `PLUGIN_STORAGE_DIR`
(`./plugins`), `LOG_LEVEL` (info), `HOST_ID` (defaults to the OS hostname; see §6). **No broker
variables** — the host never configures a broker itself.

Gaps to close for production: action route is unauthenticated (POC — must validate the service
token/HMAC like the callback path does); no `log` / `http_request` / `kv` host functions or
capability allowlist; no HTMX `render_page` / `handle_request`; registry is memory-only;
`DELETE /plugins/:id/:version` doesn't refuse removal while active configs reference it.

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

Remaining DX: align all docs/examples on one (synchronous) calling convention; de-duplicate the
`PluginManifest` type (`app/src/models/plugin-manifest.ts` vs `plugin-sdk/src/models/types.ts`); add
`onRequest` / `renderPage` for HTMX pages.

## 8. Not yet implemented ⛔

Host capabilities + host functions (`http_request`, `kv`, structured `log`) with allowlist
enforcement; downscoped user tokens for iframe→user-endpoint calls (PBAC ∩ allowlist); HTMX pages;
case tabs/widgets; menu pages; host database (KV, API logs, retention); URL-plugin mode; host-side
action authentication; broker credential delivery over TLS/HMAC rather than the admin-token channel;
event delivery durability across host downtime (currently live-subscription only).

## 9. Roadmap (priority order)

1. Authenticate the host action route (service token + HMAC) — security blocker.
2. Capabilities + host functions + allowlist enforcement; surface in the acceptance screen by category.
3. Durable/replayable event delivery option (per-host durable queue with TTL) for hosts that must not
   miss events during downtime.
4. Downscoped user tokens.
5. HTMX pages, case tabs/widgets, menu pages.
6. Host database (KV, API logs, retention) + admin log view.
7. Cleanup: de-duplicate `PluginManifest`; align async-vs-sync SDK docs.

## 10. Verification status

- Host `tsc` build and `@valtimo/plugin-sdk` build: clean.
- Backend `:backend:external-plugin:compileKotlin`: BUILD SUCCESSFUL.
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
