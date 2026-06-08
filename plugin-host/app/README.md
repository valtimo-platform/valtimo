# Plugin Host

Node.js + Fastify sidecar that manages and executes external Wasm plugins via [Extism](https://extism.org/).

## What It Does

- Accepts plugin `.zip` uploads (containing `manifest.json` + `plugin.wasm`)
- Persists plugins to disk and reloads them on restart
- Stores plugin configurations pushed from GZAC
- Executes plugin actions by calling into the Wasm module and returning process variables

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
  plugin-manager.ts     # Wasm lifecycle: load, store, call actions via Extism
  config-registry.ts    # In-memory configuration store (GZAC pushes configs here)
  index.ts              # Fastify entry point
  routes/
    health.ts           # GET /health
    host-management.ts  # Plugin CRUD (upload, list, delete)
    host-configurations.ts  # Configuration push/update/delete
    plugin-actions.ts   # Action execution + manifest retrieval
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
