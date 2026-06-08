# External Plugin System — Plan v13

External plugins extend the platform with sandboxed JS/TS backend logic and iframe frontends without
rebuilding the core app. A **definition** is a `pluginId@version` discovered on a host; a definition
may have multiple **configurations**, each with its own encrypted properties, granted permissions,
and a per-configuration service token. Hosted plugins run as `.wasm` modules in the plugin host's
Extism sandbox.

Naming: prose says "core app" / "host"; code identifiers keep their literal names (`gzac`,
`valtimo.*` properties, `external_plugin_*` tables, the `external_plugin_service` token type).

Status legend: ✅ implemented & verified · 🟡 implemented, POC-level · ⛔ not implemented.

## 1. Components

| Area | Path | Status |
|------|------|--------|
| Core-app backend module | `backend/external-plugin/` | ✅ |
| Endpoint-description providers (per module) + contract | `backend/*/.../endpoint/*EndpointDescriptionProvider.kt`, `com.ritense.valtimo.contract.endpoint.EndpointDescriptionProvider` | ✅ |
| Plugin host (Node + Fastify + Extism, multi-version) | `plugin-host/app/` | 🟡 |
| Backend plugin SDK (`@valtimo/plugin-sdk`) | `plugin-host/plugin-sdk/` | 🟡 (actions only) |
| Sample plugin | `plugin-host/sample-plugins/case-summary/` | ✅ |
| Frontend management UI + external models/service/iframe | `frontend/projects/valtimo/{plugin-management,plugin}/` | ✅ |
| Process-link (`SERVICE_TASK_START`) | `backend/external-plugin/.../processlink/` + frontend process-link | 🟡 |

Single host-per-definition, single core-app model: the core app pushes each configuration directly
to its host with a freshly issued token and a `gzacBaseUrl` callback target. Definitions are
discovered by polling each host (`GET /api/host/plugins`, default 60s) and stored with
`UNIQUE(plugin_id, version)`.

## 2. Endpoint-scoped service token & permission enforcement ✅

The security model: a plugin gets a token scoped to exactly the API endpoints its configuration was
granted, enforced per-request with deny-by-default. Verified end-to-end (code trace).

**2.1 Activation stores grants (`service/ExternalPluginConfigurationService.kt`)**
- `create()` validates properties against the definition JSON schema, then
  `validateGrantedEndpointsCoverManifest()` (`:221`) **rejects the configuration unless every
  management endpoint declared in the manifest is granted** — permissions are all-or-nothing.
- Grants persisted to `external_plugin_granted_endpoint` (`configuration_id`, `http_method`,
  `endpoint_pattern`); `update()` with non-null `grantedEndpoints` replaces them, null leaves them
  unchanged.

**2.2 Token (`service/ExternalPluginServiceTokenService.kt:42`)** — HS256 JWT:
`sub=external-plugin:{pluginId}:{configId}`, `type=external_plugin_service`,
`plugin_config_id`, `plugin_id`, `plugin_version`, `iss=valtimo-gzac`, `exp=now+24h`. **No roles.**
Signed with `valtimo.external-plugin.service-token-secret` (HMAC-SHA256, ≥32 bytes enforced by
`security/ExternalPluginServiceTokenKeyProvider.kt`).

**2.3 Recognition (`security/ExternalPluginServiceTokenFilter.kt`)** — registered **before**
`BearerTokenAuthenticationFilter` (`security/ExternalPluginCallbackHttpSecurityConfigurer.kt:31`):
parses the bearer JWT with the plugin signing key; passes through if signature/`type` don't match
(Keycloak tokens untouched); on match sets an `ExternalPluginServicePrincipal(configId,pluginId,
version)`, **strips the `Authorization` header** (so Keycloak's filter ignores it), and runs the rest
of the chain inside `AuthorizationContext.runWithoutAuthorization` (PBAC is intentionally bypassed
for service tokens — the allowlist is the sole gate).

This filter is the **only** active path: the platform's `TokenAuthenticationService` /
`SecretKeyResolver` / `JwtFilter` are `@Conditional(NoOAuth2ClientsConfiguredCondition)` and are not
instantiated when Keycloak is configured. (Consequence: the `SecretKeyProvider` /
`TokenAuthenticator` interface methods on the plugin classes are inert under Keycloak — a non-Keycloak
fallback only.)

**2.4 Enforcement (`security/ExternalPluginEndpointAllowlistFilter.kt`)** — registered **after**
`BearerTokenAuthenticationFilter` (runs before the controller, inside the no-auth scope):
1. principal not `ExternalPluginServicePrincipal` → pass through (users/existing plugins unaffected);
2. request to `/api/management/v1/external-plugin/**` → 403 (a plugin can never reach its own mgmt API);
3. load grants for `plugin_config_id`, match request via `AntPathRequestMatcher(pattern, method)`;
   no match → 403; empty grants → deny.

**2.5 Host callback** — the host's `gzac_api` host function
(`plugin-host/app/src/host-functions/gzac-api.ts`) attaches the per-config `serviceToken` as
`Authorization: Bearer` to `${gzacBaseUrl}${path}`. The token is passed via Extism `hostContext`,
never serialised into the Wasm input — plugin code never sees it.

**2.6 Token lifecycle** — 24h TTL, **no separate refresh loop**. Each healthy discovery poll
re-pushes every configuration with a freshly issued token
(`service/ExternalPluginDiscoveryService.syncConfigurations()`), continuously replacing tokens well
inside their lifetime. A dedicated 1h-token + 75%-TTL refresh is only required if the polling
re-push is removed.

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
  description) — no per-endpoint toggles — plus one acknowledgement checkbox *"I understand the
  implications of accepting these permissions"* that gates Save. Accepting grants the full declared
  set (`grantedEndpointsChange` emits every endpoint). Save → `POST .../configuration`
  `{definitionId, title, properties, grantedEndpoints}`.
- **Edit**: same component with `[readonlyMode]="true"` — list shown for reference with *"accepted at
  activation, cannot be changed here"*, always valid, and update sends `{title, properties}` only
  (grants left unchanged; immutable post-activation).
- i18n: `pluginManagement.permissions.{description, descriptionReadonly, noEndpoints, accept,
  acceptedNote}` in `core/{en,nl}.json`, app-agnostic wording.
- Only `permissions.managementEndpoints` is modelled today; when user-endpoints / events /
  capabilities land, group them by category under the same single acknowledgement.

## 4. Data model ✅ (Liquibase `13-28-0/20260504-external-plugin.xml`)

`external_plugin_host`; `external_plugin_definition` (`UNIQUE(plugin_id, version)`, `config_schema`,
`manifest_json`, `host_id`, `base_url`, `status`); `external_plugin_configuration` (`definition_id`,
`title`, `properties` encrypted via the existing `EncryptionService` on schema `x-secret` fields,
`status`); `external_plugin_granted_endpoint` (`configuration_id`, `http_method`, `endpoint_pattern`,
`granted_at`); `external_plugin_*` columns on `process_link`. Host secret stored encrypted. Not yet:
granted-capability, event-subscription, page tables.

## 5. Plugin host 🟡 (`plugin-host/app/`, Node + Fastify + Extism)

Routes: `GET /health`; `*/api/host/plugins[...]` (ADMIN_TOKEN bearer); `*/api/host/configurations[...]`
(ADMIN_TOKEN; body requires `pluginId, pluginVersion, properties, serviceToken, gzacBaseUrl`);
`POST|GET /plugins/:id/:version/actions/:key` and `/plugin-manifest`; `GET
/plugins/:id/:version/bundles/**`. Multi-version load keyed `pluginId@version`; configs held in an
in-memory registry. Only the `gzac_api` host function is registered. Per-call action input:
`{actionKey, configurationId, configuration, processInstanceId, documentId, activityId, properties}`;
output `{status, variables}`.

Gaps to close for production:
- **Action route is unauthenticated** (explicit POC comment) — must validate the service token/HMAC. **Top blocker.**
- No `log` / `http_request` / `kv` host functions; no capability allowlist enforcement.
- No RabbitMQ consumer / `handle_event`; no HTMX `render_page` / `handle_request`.
- No host DB (KV, API logs, retention); registry is memory-only.
- `DELETE /plugins/:id/:version` doesn't refuse removal while active configs reference it.

## 6. SDK & plugin developer experience

A plugin author writes `src/plugin.ts`: import `{action, config, gzacApi, log}` from
`@valtimo/plugin-sdk`, `action("key", (input) => {... return {status, variables}})`, read config via
synchronous `config.get()`, call `gzacApi.get()` (synchronous; token injected by the host). Frontend
config forms use `@valtimo/plugin-sdk/frontend` `ValtimoPluginSDK` (postMessage bridge: in
`init/save/tokenRefresh/themeChanged/prefillConfiguration`; out
`ready/resize/configurationChanged/navigate/notification`). Build: `valtimo-plugin-build` (esbuild →
`extism-js`) then `valtimo-plugin-pack` (zip of `manifest.json` + `plugin.wasm` + `frontend/`).

Implemented DX simplifications (SDK `tsc` build clean):
- Build tool **auto-generates the Wasm interface file** (`handle_action` export + `gzac_api` import)
  when the plugin ships none — authors don't hand-write Wasm pointer types; `index.d.ts` is optional.
- Frontend SDK `destroy()` listener leak fixed (bound handler shared between add/removeEventListener).
- Runtime async dispatch fixed: settles a returned promise, surfaces rejections, never serialises a
  pending `Promise`.
- Corrected `extism-js` download URL and the host README config-push example.

Remaining DX work:
- `module.exports = { handle_action }` boilerplate in `plugin.ts` — remove by bundling a generated
  entry that re-exports `handle_action`; **verify with `extism-js` before shipping** (changes the
  compiled entrypoint).
- Align SDK to one calling convention (synchronous) and update all docs/examples accordingly.
- De-duplicate the `PluginManifest` type (`app/src/models/plugin-manifest.ts` vs
  `plugin-sdk/src/models/types.ts`).
- Add SDK `onEvent` / `onRequest` / `renderPage` handlers.

## 7. Not yet implemented ⛔

Host capabilities + host functions (`http_request`, `kv`, structured `log`) with allowlist
enforcement; events/RabbitMQ per-config queues; downscoped user tokens for iframe→user-endpoint calls
(PBAC ∩ allowlist); HTMX pages; case tabs/widgets; menu pages; host database; URL-plugin mode;
host-side action authentication.

## 8. Roadmap (priority order)

1. Authenticate the host action route (service token + HMAC). **Security blocker.**
2. Unit-test `ExternalPluginEndpointAllowlistFilter` + token filter: non-plugin pass-through, mgmt
   endpoints 403, granted method+pattern match, non-granted 403, empty grants deny.
3. Remove `module.exports` boilerplate (verify with `extism-js`).
4. Capabilities + host functions + allowlist enforcement; surface in the acceptance screen by category.
5. Events (RabbitMQ + `handle_event`).
6. Downscoped user tokens.
7. HTMX pages, case tabs/widgets, menu pages.
8. Host database (KV, API logs, retention) + admin log view.
9. Cleanup: remove/justify the inert `SecretKeyProvider`/`TokenAuthenticator` impls; de-duplicate
   `PluginManifest`; align async-vs-sync SDK docs.

## 9. Verification status

- `tsc -p projects/valtimo/plugin-management/tsconfig.lib.json` → exit 0 (permission UI).
- `npm run build` in `plugin-host/plugin-sdk` → exit 0 (runtime + frontend SDK).
- `core/{en,nl}.json` parse-valid; `valtimo-plugin-build.mjs` syntax-checked.
- Token-scoping chain (§2.1–2.5) and the Keycloak conditional code-traced.
- Not run: full Angular app build, backend Gradle build/tests, `extism-js` Wasm compile.
