# Plugin Host

Node.js + Fastify sidecar that manages and executes external Wasm plugins via [Extism](https://extism.org/).

## What It Does

- Accepts plugin `.zip` uploads (containing `manifest.json` + `plugin.wasm`)
- Persists plugins to disk and plugin metadata to PostgreSQL
- Stores plugin configurations in PostgreSQL (survives restarts)
- Executes plugin actions by calling into the Wasm module and returning process variables
- Consumes platform events from RabbitMQ and delivers each to plugins that subscribe to it
  (`handle_event`) — see [Events](#events)

## Project Structure

```
src/
  db/
    index.ts              # Database pool, migrations
    config-repository.ts  # CRUD for plugin_configurations table
    plugin-repository.ts  # CRUD for plugins table
  models/
    app-config.ts         # AppConfig type + Zod schema
    host-logger.ts        # HostLogger interface
    plugin-configuration.ts  # PluginConfiguration interface
    plugin-manifest.ts    # PluginManifest interface
    index.ts              # Barrel export
  routes/
    health.ts             # GET /health
    host-management.ts    # Plugin CRUD (upload, list, delete)
    host-configurations.ts  # Configuration push/update/delete
    plugin-actions.ts     # Action execution + manifest retrieval
    plugin-bundles.ts     # Static frontend asset serving
  rabbitmq/
    event-consumer.ts     # Consumes platform events and routes them to subscribed plugins
  host-functions/
    gzac-api.ts           # Extism host function for GZAC API callbacks
  config.ts               # Environment config loader
  plugin-manager.ts       # Wasm lifecycle: load, store, call actions/events via Extism
  config-registry.ts      # Database-backed configuration store
  index.ts                # Fastify entry point
docker-compose.yml        # PostgreSQL + app containers
Dockerfile                # App container image
```

## Prerequisites

- Node.js 22+
- Docker (for database and containerized deployment)

## Quick Start (Recommended)

Run the host locally with only PostgreSQL in Docker. This works seamlessly with GZAC's RabbitMQ
since both use `localhost`.

```bash
npm install
npm run dev    # Starts db container + app with auto-reload
```

That's it. The database starts automatically and the host listens on port 8090.

### Full Docker Deployment

For production or isolated testing, run everything in Docker:

```bash
npm run build
ADMIN_TOKEN=my-secret npm run docker:up
```

Note: When running fully containerized, GZAC must push `eventBroker.amqpUrl` using
`host.docker.internal` instead of `localhost` to reach the host machine's RabbitMQ.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ADMIN_TOKEN` | yes | `changeme` (Docker) | Shared secret used as the HMAC key authenticating every GZAC→host request (see [API Reference](#api-reference)) |
| `PORT` | no | `8090` | HTTP listen port |
| `PLUGIN_STORAGE_DIR` | no | `./plugins` (local), `/data/plugins` (Docker) | Directory for persisted plugin binaries |
| `LOG_LEVEL` | no | `info` | `debug`, `info`, `warn`, or `error` |
| `HOST_ID` | no | OS hostname | Identity of this logical host; names its per-host event queue. Replicas of the **same** host must share one value (see [Events](#events)). |
| `DB_HOST` | no | `localhost` | PostgreSQL host |
| `DB_PORT` | no | `5434` | PostgreSQL port |
| `DB_NAME` | no | `pluginhost` | PostgreSQL database name |
| `DB_USER` | no | `pluginhost` | PostgreSQL username |
| `DB_PASSWORD` | no | `pluginhost` | PostgreSQL password |

The host does **not** configure an event broker. Each GZAC instance pushes its own broker connection
alongside every configuration (see [Events](#events)), so one host can serve many GZAC instances,
each on its own broker.

## NPM Scripts

### Development

| Script | Description |
|--------|-------------|
| `npm run dev` | Start db container + app with auto-reload (recommended for local dev) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled app |
| `npm run clean` | Remove `dist/`, `.tmp/`, and `plugins/` directories |

### Database

| Script | Description |
|--------|-------------|
| `npm run db:up` | Start PostgreSQL container |
| `npm run db:down` | Stop PostgreSQL container |
| `npm run db:reset` | Stop, remove volume, and restart (fresh database) |
| `npm run db:logs` | Follow PostgreSQL logs |
| `npm run db:shell` | Connect to psql shell |

### Docker

| Script | Description |
|--------|-------------|
| `npm run docker:build` | Build TypeScript and Docker image |
| `npm run docker:up` | Start full stack (db + app) |
| `npm run docker:down` | Stop all containers |
| `npm run docker:logs` | Follow app container logs |

## Persistence

| Data | Storage | Location |
|------|---------|----------|
| Plugin configurations | PostgreSQL | `plugin_configurations` table |
| Plugin metadata | PostgreSQL | `plugins` table |
| Plugin binaries (.wasm, manifest, frontend assets) | Filesystem | `PLUGIN_STORAGE_DIR` (Docker: `/data/plugins` volume) |

Configurations persist across host restarts. Event consumers automatically reconnect to brokers
referenced by persisted configurations on startup.

## Events

A GZAC instance publishes domain events through its transactional outbox as CloudEvents v1.0 JSON to
a RabbitMQ exchange (`valtimo-events`, fanout). Because a single host serves multiple GZAC instances
— each with its own broker — the **host never configures a broker itself**. Instead, each instance
pushes its broker connection (`eventBroker`) alongside every configuration on
`POST/PUT /api/host/configurations/:configId`:

```json
{
  "pluginId": "case-summary",
  "pluginVersion": "0.1.0",
  "properties": { "currency": "EUR" },
  "serviceToken": "…",
  "gzacBaseUrl": "http://localhost:8080",
  "eventBroker": {
    "amqpUrl": "amqp://guest:guest@localhost:5672",
    "exchange": "valtimo-events",
    "exchangeType": "fanout"
  }
}
```

The host opens **one consumer per distinct broker** and tears it down when no configuration
references it any more. `exchange` defaults to `valtimo-events` and `exchangeType` to `fanout`; omit
`eventBroker` (or its `amqpUrl`) to disable events for a configuration. Each broker's events are
routed only to configurations carrying that same broker.

**Multiple hosts per instance.** The exchange is a fanout, so the host binds its **own** queue —
`valtimo-external-plugins.<exchange>.<HOST_ID>` (auto-deleted when the host disconnects). This means:

- *Different* hosts on the same GZAC instance each have a distinct queue, so **every host receives a
  copy** of every event.
- *Replicas of the same host* (same `HOST_ID`) bind the **same** queue and become competing
  consumers, so each event is handled by exactly **one** replica — set a shared `HOST_ID` across
  replicas to get this load-balancing (the default OS hostname makes each replica distinct, which
  would double-handle).

Because the queue auto-deletes, events published while a host is fully down are not retained for it
(live-subscription semantics).

Round trip:

1. A GZAC instance emits an event (e.g. `com.ritense.valtimo.task.completed`,
   `com.ritense.valtimo.document.viewed`) → outbox → its `valtimo-events` exchange.
2. The host's consumer for that broker reads the CloudEvent and, for every configuration on that
   broker whose manifest lists the event's `type` under `eventSubscriptions`, invokes the plugin's
   `handle_event` export.
3. The handler runs in the Extism sandbox with the configuration's properties injected and the
   per-configuration service token available, so it can call back into that GZAC instance via
   `gzac_api`.

A plugin declares its subscriptions in `manifest.json`:

```json
"eventSubscriptions": [
  "com.ritense.valtimo.task.completed",
  "com.ritense.valtimo.document.viewed"
]
```

and registers a handler with the SDK's `onEvent`:

```ts
import { onEvent } from "@valtimo/plugin-sdk";
onEvent((event) => { /* event.type, event.resultId, event.result, ... */ });
```

## API Reference

Every GZAC→host request is authenticated with an **HMAC-SHA256 signature**, not a bearer token. The
signature is computed over the canonical string `{METHOD}\n{path}\n{timestamp}\n{bodyHash}` keyed
with the `ADMIN_TOKEN`, where:

- `path` is the request path without the query string;
- `bodyHash` is `SHA-256(body)` hex — the empty string for GET/DELETE, and the **uploaded file
  bytes** (not the multipart envelope) for the plugin upload;
- `timestamp` is an ISO-8601 instant; the host rejects anything more than **±5 minutes** from its
  own clock (replay protection).

It is sent as two headers: `X-Valtimo-Signature` (the hex HMAC) and `X-Valtimo-Timestamp`. In
production GZAC's `ExternalPluginHostClient` signs every call automatically. To call the host by
hand, sign with this helper (requires `openssl`):

```bash
ADMIN_TOKEN=test-secret
# host_sign METHOD PATH [BODY_FILE]  →  sets $TS and $SIG for the curl calls below
host_sign() {
  TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  local hash
  hash="$(openssl dgst -sha256 -hex "${3:-/dev/null}" | awk '{print $NF}')"
  SIG="$(printf '%s\n%s\n%s\n%s' "$1" "$2" "$TS" "$hash" \
    | openssl dgst -sha256 -hmac "$ADMIN_TOKEN" -hex | awk '{print $NF}')"
}
```

`GET /health` is the only unauthenticated route.

### `GET /health`

```bash
curl -sS http://localhost:8090/health | jq .
```

### `GET /api/host/plugins` — list all loaded plugins

```bash
host_sign GET /api/host/plugins
curl -sS http://localhost:8090/api/host/plugins \
  -H "X-Valtimo-Timestamp: $TS" -H "X-Valtimo-Signature: $SIG" | jq .
```

### `GET /api/host/plugins/:pluginId` — list all versions of a plugin

```bash
host_sign GET /api/host/plugins/say-hello
curl -sS http://localhost:8090/api/host/plugins/say-hello \
  -H "X-Valtimo-Timestamp: $TS" -H "X-Valtimo-Signature: $SIG" | jq .
```

### `POST /api/host/plugins` — upload plugin `.zip` (multipart)

The signature binds the **file bytes**, so sign the `.zip` itself:

```bash
host_sign POST /api/host/plugins ../sample-plugins/say-hello/dist/say-hello-0.1.0.zip
curl -sS -X POST http://localhost:8090/api/host/plugins \
  -H "X-Valtimo-Timestamp: $TS" -H "X-Valtimo-Signature: $SIG" \
  -F "file=@../sample-plugins/say-hello/dist/say-hello-0.1.0.zip" | jq .
```

### `DELETE /api/host/plugins/:pluginId/:version` — remove a plugin

```bash
host_sign DELETE /api/host/plugins/say-hello/0.1.0
curl -sS -X DELETE http://localhost:8090/api/host/plugins/say-hello/0.1.0 \
  -H "X-Valtimo-Timestamp: $TS" -H "X-Valtimo-Signature: $SIG" -w "\nHTTP %{http_code}\n"
```

### `GET /api/host/configurations` — list all configurations

```bash
host_sign GET /api/host/configurations
curl -sS http://localhost:8090/api/host/configurations \
  -H "X-Valtimo-Timestamp: $TS" -H "X-Valtimo-Signature: $SIG" | jq .
```

### `POST /api/host/configurations/:configId` — push configuration

`serviceToken` and `gzacBaseUrl` are required — the host uses them to authenticate and route the
plugin's API callbacks. For local testing any non-empty string works for `serviceToken`. Write the
body to a file so the signed bytes and the sent bytes match exactly (`--data-binary @file`):

```bash
cat > /tmp/config.json <<'JSON'
{"pluginId":"say-hello","pluginVersion":"0.1.0","properties":{"greeting":"Hello"},"serviceToken":"local-test-token","gzacBaseUrl":"http://localhost:8080"}
JSON
host_sign POST /api/host/configurations/my-config /tmp/config.json
curl -sS -X POST http://localhost:8090/api/host/configurations/my-config \
  -H "X-Valtimo-Timestamp: $TS" -H "X-Valtimo-Signature: $SIG" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/config.json | jq .
```

### `PUT /api/host/configurations/:configId` — update configuration

```bash
printf '%s' '{"properties":{"greeting":"Hola"}}' > /tmp/config.json
host_sign PUT /api/host/configurations/my-config /tmp/config.json
curl -sS -X PUT http://localhost:8090/api/host/configurations/my-config \
  -H "X-Valtimo-Timestamp: $TS" -H "X-Valtimo-Signature: $SIG" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/config.json | jq .
```

### `DELETE /api/host/configurations/:configId` — remove configuration

```bash
host_sign DELETE /api/host/configurations/my-config
curl -sS -X DELETE http://localhost:8090/api/host/configurations/my-config \
  -H "X-Valtimo-Timestamp: $TS" -H "X-Valtimo-Signature: $SIG" -w "\nHTTP %{http_code}\n"
```

### `POST /plugins/:pluginId/:version/actions/:actionKey` — execute an action

```bash
printf '%s' '{"configurationId":"my-config","processInstanceId":"p1","documentId":"d1","activityId":"a1","properties":{"recipient":"World"}}' > /tmp/action.json
host_sign POST /plugins/say-hello/0.1.0/actions/say-hello /tmp/action.json
curl -sS -X POST http://localhost:8090/plugins/say-hello/0.1.0/actions/say-hello \
  -H "X-Valtimo-Timestamp: $TS" -H "X-Valtimo-Signature: $SIG" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/action.json | jq .
```

### `GET /plugins/:pluginId/:version/plugin-manifest` — get plugin manifest

```bash
curl -sS http://localhost:8090/plugins/say-hello/0.1.0/plugin-manifest | jq .
```
