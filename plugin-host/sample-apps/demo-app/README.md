# Valtimo Demo App (URL app)

A **reference app** for Valtimo's external-plugin system. An *app* is a remote HTTP service, added
to GZAC by URL, that **is a plugin-host-plus-single-plugin**: it speaks the exact same HTTP contract
a plugin host speaks to GZAC, but serves one plugin implemented **natively** (no Extism/WASM, no
uploads). This project is both a runnable demo and a documented reference for that contract.

Where a WASM plugin exports `handle_action` / `handle_request` / `handle_event`, this app implements
the same three concerns as plain TypeScript functions in [`src/plugin.ts`](src/plugin.ts).

## What it demonstrates

| Surface | Where | How to see it |
|---|---|---|
| **Discovery** | `GET /api/host/plugins` | The app appears CONNECTED with one plugin right after you add it. |
| **Config UI (iframe)** | `frontend/config.tsx` | The "Configure plugin" step renders the app's own form. |
| **Action** (`SERVICE_TASK_START`) | `runAction` + `frontend/action-config.tsx` | Bind `greet` to a BPMN service task; it writes a `greeting` process variable. |
| **App-served data** | `handleRequest("/info")` | Shown in the case tab, panel 2. |
| **Case tab (iframe)** | `frontend/case-tab.tsx` | Four communication levels side by side (see below). |
| **Backend → GZAC (user vs service token)** | `handleRequest("/case-count-*")` | Case tab panels 4 & 5 compare token scopes. |
| **Events** | `handleEvent` + `src/events.ts` | On `document.created` the app posts a note back to the document. |

The case tab shows the four communication levels the platform supports:

1. **tab → GZAC (user token)** — `sdk.callValtimo` through the parent-proxy (PBAC ∩ allowlist).
2. **tab → app backend** — `sdk.getPluginData("/info")`, no GZAC.
3. **tab → app backend → GZAC (user token)** — row-level PBAC ∩ allowlist.
4. **tab → app backend → GZAC (service token)** — PBAC bypassed, allowlist only (broader scope).

## Requirements

- Node.js ≥ 22
- The sibling `../../plugin-sdk` package built (`cd ../../plugin-sdk && npm install && npm run build`)
  — the browser bundles import `@valtimo/plugin-sdk/frontend`. Running `npm run setup` once at the
  [plugin-host root](../../README.md#quick-start) covers this and installs this app too.

## Install, build & run

```bash
cd plugin-host/sample-apps/demo-app
npm install
npm run dev                              # builds the iframe bundles, then watches src/ (ADMIN_TOKEN=test-secret)
# or, for a production-style run:
npm run build
ADMIN_TOKEN=test-secret npm start
```

The app listens on `http://localhost:8095` by default.

### Environment

| Var | Default | Notes |
|---|---|---|
| `ADMIN_TOKEN` | *(required)* | Shared secret; the HMAC key GZAC signs every request with. Must equal the "secret" you enter when registering the app. |
| `PORT` | `8095` | HTTP port. |
| `LOG_LEVEL` | `info` | `debug`/`info`/`warn`/`error`. |
| `HOST_ID` | OS hostname | Names the app's event queue on GZAC's exchange. |

There is **no** database and **no** broker configuration: the app keeps pushed configurations in
memory and learns its broker (if any) from GZAC's configuration push.

## Register it in GZAC

1. Start GZAC and the demo app.
2. In **Admin → Plugins → Integrations**, click **Add app**.
3. Fill in:
   - **Base URL**: `http://localhost:8095`
   - **Secret**: the `ADMIN_TOKEN` the app runs with (`test-secret` when started via `npm run dev`)
   - **GZAC callback URL**: `http://localhost:8080` (the backend's own URL)
   - **Event broker** (optional): leave blank to skip events, or fill in the AMQP URL to enable them.
4. Save. The app is polled immediately and its single plugin appears under **Configurations →
   Configure plugin**.
5. Configure the plugin (set a *greeting prefix*), grant the requested endpoints, and activate.

Then, to exercise each surface:

- **Action**: add a BPMN service task, link it to the app's **Build greeting** action, run the
  process, and check the `greeting` process variable.
- **Case tab**: in **Case admin**, add a tab of type **External plugin** pointing at the app's
  case-tab bundle; open a case to see the four levels.
- **Events**: enable a broker at registration, create a document, and watch the app log
  `added note to document …` (a note appears on the document).

## The contract (routes)

Authenticated GZAC→app routes (HMAC-SHA256 over `{METHOD}\n{path}\n{timestamp}\n{sha256(body)}`,
headers `X-Valtimo-Signature` / `X-Valtimo-Timestamp`, ±5-min replay window — see [`src/hmac.ts`](src/hmac.ts)):

- `GET  /api/host/plugins` — discovery: returns `[{ pluginId, version, manifest }]`
- `POST /api/host/configurations/:configId` — configuration push (service token, callback URL,
  broker, and the pushing GZAC's `ownerId` — persist and echo it so GZAC's reconciliation pass can
  prune its own orphaned configurations without touching another instance's)
- `PUT  /api/host/configurations/:configId` — configuration update (preserve the stored `ownerId`
  when the body omits it)
- `DELETE /api/host/configurations/:configId` — configuration removal
- `GET  /api/host/configurations` — list stored configurations as
  `[{ configurationId, pluginId, pluginVersion, ownerId }]` summaries (no tokens/properties/broker
  — one host may serve several GZAC instances). Implementing this route is what opts an app into
  GZAC's reconciliation; without it GZAC simply skips the pass.
- `POST /plugins/:pluginId/:version/actions/:actionKey` — invoke an action

Public routes (CORS `*`, loaded by the sandboxed iframe):

- `GET  /health`
- `GET  /plugins/:pluginId/:version/plugin-manifest`
- `GET  /plugins/:pluginId/:version/bundles/*`
- `GET  /plugins/:pluginId/:version/logo`
- `POST /plugins/:pluginId/:version/data` — `handle_request` (⚠️ public in this iteration, like the
  plugin host; a production app would gate it)

## Notes

- Unlike a plugin host, an app has a single, natively-implemented plugin and does **not** accept
  uploads (GZAC's backend and UI both prevent uploading to an app).
- HTTP status conventions match the plugin host: action success → `200 {status:"completed"}`,
  plugin-level error → `422 {status:"error",…}`; the `/data` route returns the handler's `status`
  and `body` directly.
