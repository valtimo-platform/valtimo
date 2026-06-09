# Plugin Host

Node.js + Fastify sidecar that manages and executes external Wasm plugins via [Extism](https://extism.org/).

## What It Does

- Accepts plugin `.zip` uploads (containing `manifest.json` + `plugin.wasm`)
- Persists plugins to disk and reloads them on restart
- Stores plugin configurations pushed from GZAC
- Executes plugin actions by calling into the Wasm module and returning process variables
- Consumes platform events from RabbitMQ and delivers each to plugins that subscribe to it
  (`handle_event`) — see [Events](#events)

## Project Structure

```
src/
  models/
    app-config.ts       # AppConfig type + Zod schema
    host-logger.ts      # HostLogger interface
    plugin-configuration.ts  # PluginConfiguration interface
    plugin-manifest.ts  # PluginManifest interface
    index.ts            # Barrel export
  config.ts             # Environment config loader
  plugin-manager.ts     # Wasm lifecycle: load, store, call actions/events via Extism
  config-registry.ts    # In-memory configuration store (GZAC pushes configs here)
  index.ts              # Fastify entry point
  routes/
    health.ts           # GET /health
    host-management.ts  # Plugin CRUD (upload, list, delete)
    host-configurations.ts  # Configuration push/update/delete
    plugin-actions.ts   # Action execution + manifest retrieval
  rabbitmq/
    event-consumer.ts   # Consumes platform events and routes them to subscribed plugins
```

## Prerequisites

- Node.js 22+

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ADMIN_TOKEN` | yes | — | Bearer token for management API |
| `PORT` | no | `8090` | HTTP listen port |
| `PLUGIN_STORAGE_DIR` | no | `/plugins` | Directory for persisted plugins |
| `LOG_LEVEL` | no | `info` | `debug`, `info`, `warn`, or `error` |
| `HOST_ID` | no | OS hostname | Identity of this logical host; names its per-host event queue. Replicas of the **same** host must share one value (see [Events](#events)). |

The host does **not** configure an event broker. Each GZAC instance pushes its own broker connection
alongside every configuration (see [Events](#events)), so one host can serve many GZAC instances,
each on its own broker.

## Running Locally

```bash
npm install
npm run build          # tsc → dist/
ADMIN_TOKEN=test-secret PLUGIN_STORAGE_DIR=/tmp/plugins npm start
```

For development with auto-reload:

```bash
ADMIN_TOKEN=test-secret PLUGIN_STORAGE_DIR=/tmp/plugins npm run dev
```

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

All management endpoints require `Authorization: Bearer <ADMIN_TOKEN>`.

### `GET /health`

```bash
curl -sS http://localhost:8090/health | jq .
```

### `GET /api/host/plugins` — list all loaded plugins

```bash
curl -sS http://localhost:8090/api/host/plugins \
  -H "Authorization: Bearer test-secret" | jq .
```

### `GET /api/host/plugins/:pluginId` — list all versions of a plugin

```bash
curl -sS http://localhost:8090/api/host/plugins/say-hello \
  -H "Authorization: Bearer test-secret" | jq .
```

### `POST /api/host/plugins` — upload plugin `.zip` (multipart)

```bash
curl -sS -X POST http://localhost:8090/api/host/plugins \
  -H "Authorization: Bearer test-secret" \
  -F "file=@../sample-plugins/say-hello/dist/say-hello-0.1.0.zip" | jq .
```

### `DELETE /api/host/plugins/:pluginId/:version` — remove a plugin

```bash
curl -sS -X DELETE http://localhost:8090/api/host/plugins/say-hello/0.1.0 \
  -H "Authorization: Bearer test-secret" -w "\nHTTP %{http_code}\n"
```

### `GET /api/host/configurations` — list all configurations

```bash
curl -sS http://localhost:8090/api/host/configurations \
  -H "Authorization: Bearer test-secret" | jq .
```

### `POST /api/host/configurations/:configId` — push configuration

`serviceToken` and `gzacBaseUrl` are required — the host uses them to authenticate and route the
plugin's API callbacks. For local testing any non-empty string works for `serviceToken`.

```bash
curl -sS -X POST http://localhost:8090/api/host/configurations/my-config \
  -H "Authorization: Bearer test-secret" \
  -H "Content-Type: application/json" \
  -d '{"pluginId":"say-hello","pluginVersion":"0.1.0","properties":{"greeting":"Hello"},"serviceToken":"local-test-token","gzacBaseUrl":"http://localhost:8080"}' | jq .
```

### `PUT /api/host/configurations/:configId` — update configuration

```bash
curl -sS -X PUT http://localhost:8090/api/host/configurations/my-config \
  -H "Authorization: Bearer test-secret" \
  -H "Content-Type: application/json" \
  -d '{"properties":{"greeting":"Hola"}}' | jq .
```

### `DELETE /api/host/configurations/:configId` — remove configuration

```bash
curl -sS -X DELETE http://localhost:8090/api/host/configurations/my-config \
  -H "Authorization: Bearer test-secret" -w "\nHTTP %{http_code}\n"
```

### `POST /plugins/:pluginId/:version/actions/:actionKey` — execute an action

```bash
curl -sS -X POST http://localhost:8090/plugins/say-hello/0.1.0/actions/say-hello \
  -H "Content-Type: application/json" \
  -d '{"configurationId":"my-config","processInstanceId":"p1","documentId":"d1","activityId":"a1","properties":{"recipient":"World"}}' | jq .
```

### `GET /plugins/:pluginId/:version/plugin-manifest` — get plugin manifest

```bash
curl -sS http://localhost:8090/plugins/say-hello/0.1.0/plugin-manifest | jq .
```
