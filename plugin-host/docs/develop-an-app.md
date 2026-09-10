<!--
  Copyright 2015-2026 Ritense BV, the Netherlands.
  Licensed under EUPL, Version 1.2 (the "License");
  https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
-->

# Developing an app

> **Audience:** developers building a standalone service that plugs into GZAC. For the
> administrator side see [Add an app](../../documentation/configuration-guides/plugins/external-plugins/add-an-app.md).

An **app** is a remote HTTP service that GZAC treats as a plugin-host-plus-single-plugin: it
speaks the same GZAC↔host contract, but serves one natively-implemented plugin and accepts no
uploads. Everything downstream of registration — service tokens, the endpoint allowlist, user
tokens, iframe surfaces, event delivery — works identically to a hosted plugin, for free.

**Build a plugin when you can; build an app when you must.** A Wasm plugin gets the sandbox,
capability gating, and content pinning from the host. An app trades that for full freedom (any
language, any runtime, its own persistence) and takes on the contract obligations below itself.

The reference implementation is [`sample-apps/demo-app/`](../sample-apps/demo-app/) — a small
Node + Fastify service implementing the whole contract; each section below names the file that
demonstrates it. This page documents every request GZAC sends and every response it expects, so
you can build against it without reverse-engineering.

Two companion pages carry what this one deliberately does not repeat:
[Developing an external plugin](./develop-a-plugin.md) explains the concepts an app inherits
unchanged — the configuration as the unit of everything, the request/grant/enforce permission
model, and which surface to build for which goal — and
[The Valtimo API and event catalogue](./valtimo-api-and-events.md) lists what you can call and
subscribe to.

## What a minimal app has to implement

The full contract below is large, but very little of it is mandatory. An app that only runs
process actions needs four routes:

| Route | Why it is unavoidable |
|---|---|
| `GET /health` | Liveness; any 2xx |
| `GET /api/host/plugins` | Discovery. Must work **before** first registration |
| `POST`/`PUT`/`DELETE /api/host/configurations/{configId}` | Receives the settings, grants and service token you need to do anything |
| `POST /plugins/{pluginId}/{version}/actions/{actionKey}` | Runs the action |

Everything else is opt-in, and skipping it degrades cleanly:

| Skip | Consequence |
|---|---|
| `GET /api/host/configurations` | No reconciliation — GZAC skips that pass for your app, and configurations deleted while you were unreachable linger until you remove them |
| `PUT /api/host/gzac-instances` | GZAC treats a 404 as "serves no framable screens". Correct for an actions-only app |
| Public routes (`/plugin-manifest`, `/bundles/*`, `/data`, `/frame-policy`) | No plugin screens. Omit them unless your manifest declares `frontendBundles` |
| `POST …/submit/{submitKey}` | Only needed for a `task-form` bundle with `submitHandler: true` |
| Event consumption | Declare no `eventSubscriptions` and ignore `eventBroker` |
| `contentHash` | Recommended, not required. Without it GZAC cannot pin your content, so a change never triggers admin re-acceptance |

Start there, confirm an action runs end to end, then add surfaces.

## Lifecycle

1. An administrator registers your app (base URL + secret). GZAC **discovers it immediately** —
   `GET /api/host/plugins` must work before first registration, because the add-app wizard flows
   straight into configuring your plugin.
2. From then on GZAC polls every ~60 s: `GET /health`, `GET /api/host/plugins`,
   `GET /api/host/configurations`, `PUT /api/host/gzac-instances`, and a **re-push of every
   active configuration** with a freshly minted service token.
3. When the admin activates/edits/deletes a configuration, GZAC pushes/deletes it immediately as
   well. Actions and task-form hooks arrive whenever a process or task needs them.

## Authentication — verifying the HMAC

Every GZAC→app request (all routes except the public plugin surfaces) carries two headers:

```
X-Valtimo-Timestamp: 2026-09-01T12:00:00Z          # ISO-8601 UTC, Instant.now() on the GZAC side
X-Valtimo-Signature: 3f1a…                          # lowercase hex
```

The signature is `HMAC-SHA256` over this exact string, keyed with your app's admin secret (the
value the administrator entered):

```
{METHOD}\n{path}\n{timestamp}\n{bodyHash}
```

- `path` — the bare route path without query string (`/api/host/configurations/abc`). A reverse
  proxy in front of your app must not add a path prefix, or verification breaks.
- `bodyHash` — SHA-256 hex of the **raw request bytes**; for body-less requests (GET/DELETE) the
  hash of the empty string (`e3b0c442…`). Hash the bytes as received — re-serialising parsed
  JSON produces different bytes and a false mismatch.

Verify with: both headers present → timestamp within ±5 minutes → recompute and compare
**timing-safe** → reject a **signature you have already accepted** on POST/PUT/DELETE/PATCH
(single-use within the window; this closes replays). Respond `401` on any failure.

Reference: [`demo-app/src/hmac.ts`](../sample-apps/demo-app/src/hmac.ts) (a Fastify `preHandler`
with raw-body capture), and
[`test-fixtures/hmac-vectors.json`](../test-fixtures/hmac-vectors.json) — openssl-generated
golden vectors to pin your implementation against, the same file the GZAC side is tested with.

## Routes GZAC calls (HMAC)

### `GET /health`

Liveness probe; any 2xx counts. `{"status": "UP"}` by convention.

### `GET /api/host/plugins` — discovery

Return your single plugin. Note the field is `version` here (it is `pluginVersion` in the
config push):

```json
[
  {
    "pluginId": "demo-app",
    "version": "1.0.0",
    "manifest": { …full plugin manifest… },
    "contentHash": "sha256:…"
  }
]
```

The `manifest` follows the same rules as a packaged plugin's `manifest.json` — per-locale
`translations`, `permissions`, `eventSubscriptions`, `actions`, `frontendBundles`,
`configurationSchema` (see
[Project anatomy & manifest](./develop-a-plugin.md#2-project-anatomy--manifest)). What you declare
here is what the administrator is asked to accept, so the same rule applies: declare the minimum
you need, and ship a `config` bundle unless you want administrators hand-writing your settings as
JSON.

`contentHash` is optional. Serve a stable value that changes when your plugin's behavior/manifest
changes and GZAC pins it, flagging unexpected changes for admin re-acceptance — recommended, and
cheap if you derive it from your build.

### `PUT /api/host/gzac-instances` — frame-ancestor announcement (optional)

```json
{ "gzacBaseUrl": "http://gzac:8080", "frontendOrigins": ["https://valtimo.example.com"] }
```

Store per `gzacBaseUrl` (GZAC re-announces every poll — memory is fine; a restart converges
within one cycle) and serve the **union of all announced origins** as the `frame-ancestors` CSP
on your bundles; with none announced, fail closed (`'none'`). Reply 200. An app that serves no
framable screens may simply not implement the route — GZAC treats a 404 as unsupported.

### `POST /api/host/configurations/{configId}` — configuration push

The heart of the contract. Everything your app is allowed to do arrives in this body:

```json
{
  "pluginId": "demo-app",
  "pluginVersion": "1.0.0",
  "properties": { "greeting": "Hello" },
  "serviceToken": "eyJ…",
  "gzacBaseUrl": "http://gzac:8080",
  "ownerId": "0f3c9a52-…",
  "expectedContentHash": "sha256:…",
  "eventSubscriptions": ["com.ritense.valtimo.document.created"],
  "grantedCapabilities": ["gzac_api", "log", "frontend_data"],
  "grantedEndpoints": [{ "method": "POST", "pattern": "/api/v1/document/*/note" }],
  "allowedEgress": ["api.example.com"],
  "eventBroker": {
    "amqpUrl": "amqp://user:pass@rabbitmq:5672",
    "exchange": "valtimo-events",
    "exchangeType": "fanout",
    "queueMode": "live",
    "queueTtlMs": null
  }
}
```

| Field | What to do with it |
|---|---|
| `serviceToken` | **Required — 400 without it.** Your credential for calling GZAC back. Replaced on every poll; expires in ~10 minutes. Never cache beyond the next push, never expose it (not in the listing, not to the browser). |
| `gzacBaseUrl` | **Required.** The base URL for callbacks, and the identity of the pushing GZAC instance. |
| `properties` | The configuration values the admin entered (secrets decrypted — server-side only). |
| `ownerId` | Opaque identity of the GZAC↔app relationship. Persist and echo it in the listing; it is what lets a GZAC clean up only its own configurations. |
| `eventSubscriptions` | The **granted** event types — deliver these and nothing else, regardless of your manifest. |
| `grantedCapabilities` / `grantedEndpoints` / `allowedEgress` | The accepted permission sets. Honor them: don't call GZAC endpoints outside the granted list (GZAC enforces it server-side anyway), gate your `/data` route on `frontend_data`, restrict outbound calls to `allowedEgress`. |
| `expectedContentHash` | Present when GZAC pinned your `contentHash`. If it doesn't match what you currently serve, refuse with `409` — the admin accepted different content. |
| `eventBroker` | Broker connection for events; absent = events disabled for this configuration. Normalize defensively: unknown `queueMode` → `live`; clamp `queueTtlMs` to 1 h–30 d (default 72 h) in `durable` mode. |

Reply `201` (or `200`). `PUT` on the same path is an update — merge into the stored record.
`DELETE` removes it (`204`; a repeated delete may 404 — GZAC treats that as success). After any
mutation, re-sync your event consumers.

### `GET /api/host/configurations` — redacted listing

```json
[ { "configurationId": "…", "pluginId": "demo-app", "pluginVersion": "1.0.0", "ownerId": "…" } ]
```

**Summaries only.** An app can serve many GZAC instances, all authenticating with the same
secret — a full listing would hand each of them the others' service tokens, properties, and
broker credentials. GZAC uses this for its reconciliation pass: entries carrying *its* `ownerId`
that no longer exist on its side get a `DELETE`.

### `POST /plugins/{pluginId}/{version}/actions/{actionKey}` — run an action

Request:

```json
{
  "configurationId": "…",
  "processInstanceId": "…",
  "activityId": "GenerateGreeting",
  "documentId": "…",
  "properties": { "name": "resolved value" }
}
```

`documentId` is absent for processes without a case document. `properties` are the process-link
action inputs, value-resolver expressions already resolved.

Responses GZAC understands:

| Status | Body | Effect in GZAC |
|---|---|---|
| 200 | `{ "status": "completed", "variables": { … }, "result": { … } }` | `variables` become process variables; the optional `result` feeds the link's output mappings. |
| 4xx/5xx | `{ "status": "error", "errorCode": "…", "errorMessage": "…" }` | Surfaced to the process as a BPMN error (`errorCode` is the BPMN error code). The demo app uses 422 for plugin-level errors, 500 for crashes. |

If your app is unreachable, GZAC synthesizes a 503 `EXTERNAL_PLUGIN_HOST_UNREACHABLE` failure —
the process error path always engages.

### `POST /plugins/{pluginId}/{version}/submit/{submitKey}` — task-form hook

Only needed when a `task-form` bundle declares `submitHandler: true`. Request:

```json
{ "configurationId": "…", "taskId": "…", "processInstanceId": "…", "documentId": "…", "submission": { … } }
```

Reply `{ "status": "completed", "variables": { … }, "documentContent": { … } }` and GZAC
completes the task with those values, or
`{ "status": "error", "errorMessage": "…", "fieldErrors": { "field": "message" } }` (non-2xx) and
GZAC does **not** complete — the errors render inline on the form.

## Public routes (browser-facing, CORS `*`)

- **`GET …/plugin-manifest`** — the manifest JSON. The iframe SDK fetches it for translations.
- **`GET …/bundles/*`** and **`GET …/logo`** — your built frontend assets. Guard against path
  traversal; serve a restrictive CSP (`default-src 'none'; script-src 'self'; connect-src
  'self'; …`) plus the announced `frame-ancestors`. Bundles are ordinary web apps built against
  `@valtimo/plugin-sdk/frontend` — see [demo-app/frontend](../sample-apps/demo-app/frontend/).
- **`GET …/frame-policy?origin=`** — optional; answer `{ "allowed": true|false }` for the one
  origin named. The frontend SDK probes it as defence in depth; an unanswered probe only warns.
- **`POST …/data`** (+ `OPTIONS` preflight) — how your screens fetch data. The GZAC frontend's
  parent-proxy posts:

  ```json
  {
    "configurationId": "…",
    "method": "GET",
    "path": "/summary",
    "query": { … },
    "body": null,
    "context": { "documentId": "…", "pluginConfigurationId": "…" },
    "userToken": "eyJ…"
  }
  ```

  Route `method` + `path` to your handler; reply with the handler's status as the HTTP status
  and its body as the HTTP body — the parent-proxy forwards `{status, body}` to the iframe.

  **Gate it like the plugin host does** (the demo app deliberately skips this — a documented POC
  gap; do not copy that): the configuration must exist, target this plugin version, and have
  `frontend_data` in its pushed grants (one uninformative 403 otherwise); rate-limit per
  configuration; require the `userToken` and validate it by remote introspection —
  `GET {gzacBaseUrl}/api/v1/external-plugin/user-token/introspect` with the token as the bearer
  credential returns `{ "subject": "…", "configurationId": "…", "expiresAt": "…" }` on 200.
  Reject when GZAC rejects (401), when the token's `configurationId` differs from the request's
  (403), and **fail closed when GZAC is unreachable** (503). Cache positive verdicts briefly
  (≤60 s, never past `expiresAt`). The `userToken` also lets you call GZAC *as the user* —
  attach it instead of the service token, and the call is bounded by that user's permissions.

## Calling GZAC back

`Authorization: Bearer {serviceToken}` against `{gzacBaseUrl}` — see
[`demo-app/src/gzac.ts`](../sample-apps/demo-app/src/gzac.ts). The token bypasses user
permission checks; its reach is exactly the granted endpoint list, so treat that list as your
API surface. For per-user calls (from `/data` handlers), use the introspected `userToken`
instead — it is bounded by that user's own permissions as well as the endpoint list, which is what
keeps a plugin screen from becoming a way around access control.

Which endpoints exist, how to discover them for the version you target, and the handful that no
grant can ever unlock are documented in
[The Valtimo API and event catalogue](./valtimo-api-and-events.md#part-1--calling-the-valtimo-api).

## Events

When a push carries `eventBroker`, consume the fanout exchange with the semantics of
`queueMode`: `live` → `{durable: false, autoDelete: true}` (events while you're down are lost);
`durable` → `{durable: true, autoDelete: false, arguments: {"x-expires": queueTtlMs}}`. Use a
queue name unique to your app instance; include mode/TTL in the name so a settings change
declares a fresh queue instead of colliding with the old declaration. Messages are CloudEvents
(JSON); dispatch only the **granted** `eventSubscriptions`, ack on success, drop (don't requeue)
malformed messages, reconnect with backoff, and make handlers idempotent — delivery is
at-least-once. Reference: [`demo-app/src/events.ts`](../sample-apps/demo-app/src/events.ts).

The event types you can subscribe to, and what each payload contains, are in
[the event catalogue](./valtimo-api-and-events.md#part-2--events). Payloads are serialisations of
internal Valtimo classes and are not a stable contract — read the few fields you need, and prefer
an API call keyed on `resultId` when the data matters.

## Checklist

- [ ] `GET /health`, `GET /api/host/plugins` (with `manifest`, ideally `contentHash`) work before first registration
- [ ] HMAC verified on every GZAC-facing route: ±5 min window, timing-safe, replay-rejecting; pinned against `hmac-vectors.json`
- [ ] Config push persisted; `serviceToken`/`gzacBaseUrl` required; `ownerId` echoed; listing returns summaries only
- [ ] Action route speaks `{status, variables, result?}` / `{status:"error", errorCode, errorMessage}`
- [ ] Granted sets honored: events dispatched from `eventSubscriptions`, callbacks within `grantedEndpoints`, egress within `allowedEgress`
- [ ] Bundles served with strict CSP + announced `frame-ancestors`, fail closed
- [ ] `/data` gated: `frontend_data` grant, rate limit, user-token introspection, fail closed on GZAC outage
- [ ] Served over HTTPS (or loopback in development) — GZAC refuses to push broker credentials to a plain-HTTP remote app
