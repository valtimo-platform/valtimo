# Valtimo External Plugin System

WebAssembly-based plugin system for extending Valtimo GZAC with custom actions and event handlers.

## Components

| Directory | Description |
|-----------|-------------|
| [`app/`](./app/) | **Plugin Host** — Node.js sidecar that loads, stores, and executes Wasm plugins |
| [`plugin-sdk/`](./plugin-sdk/) | **SDK** — TypeScript library and build tools for plugin authors |
| [`sample-plugins/`](./sample-plugins/) | **Sample plugins** — Reference implementations |

## Architecture

```
┌─────────────┐      push configs       ┌─────────────────┐
│    GZAC     │ ───────────────────────▶│   Plugin Host   │
│  (backend)  │                         │  (Node.js app)  │
│             │◀─── action results ─────│                 │
│             │                         │  ┌───────────┐  │
│             │                         │  │ Extism    │  │
│             │──── call action ───────▶│  │  ┌─────┐  │  │
│             │                         │  │  │Wasm │  │  │
│             │                         │  │  │Plug │  │  │
│             │     gzac_api callback   │  │  │ in  │  │  │
│             │◀────────────────────────│  │  └─────┘  │  │
│             │                         │  └───────────┘  │
└─────────────┘                         └────────┬────────┘
                                                 │
                                                 │ persists
                                                 ▼
                                        ┌─────────────────┐
                                        │   PostgreSQL    │
                                        │  (configs, etc) │
                                        └─────────────────┘
```

## Quick Start

### 1. Start the Plugin Host

```bash
cd app
npm install
npm run db:up      # Start PostgreSQL
npm run dev        # Start host with auto-reload
```

### 2. Build a Sample Plugin

```bash
cd plugin-sdk
npm install && npm run build

cd ../sample-plugins/case-summary
npm install
npm run build:pack
```

### 3. Upload and Test

Every GZAC→host request is HMAC-SHA256 signed (not a bearer token): the signature covers
`{METHOD}\n{path}\n{timestamp}\n{bodyHash}` keyed with the `ADMIN_TOKEN`, sent as `X-Valtimo-Signature`
+ `X-Valtimo-Timestamp` (±5-minute replay window). The plugin upload signs the file bytes; other
write routes sign the request body. HMAC authenticates and integrity-binds each request but does not
encrypt it — run the host over TLS (set `TLS_CERT_PATH`/`TLS_KEY_PATH`) so the config push, which
carries broker credentials and the service token, is also confidential. See
[`app/README.md`](app/README.md#api-reference) for the full scheme and the `host_sign` helper used
below, and [Transport security](app/README.md#transport-security) for TLS.

```bash
ADMIN_TOKEN=test-secret
# host_sign METHOD PATH [BODY_FILE]  →  sets $TS and $SIG
host_sign() {
  TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  local hash; hash="$(openssl dgst -sha256 -hex "${3:-/dev/null}" | awk '{print $NF}')"
  SIG="$(printf '%s\n%s\n%s\n%s' "$1" "$2" "$TS" "$hash" \
    | openssl dgst -sha256 -hmac "$ADMIN_TOKEN" -hex | awk '{print $NF}')"
}

# Upload plugin (signature binds the .zip file bytes)
host_sign POST /api/host/plugins sample-plugins/case-summary/dist/case-summary-0.1.0.zip
curl -X POST http://localhost:8090/api/host/plugins \
  -H "X-Valtimo-Timestamp: $TS" -H "X-Valtimo-Signature: $SIG" \
  -F "file=@sample-plugins/case-summary/dist/case-summary-0.1.0.zip"

# Push a configuration (signature binds the JSON body)
printf '%s' '{"pluginId":"case-summary","pluginVersion":"0.1.0","properties":{"titleField":"/name"},"serviceToken":"test","gzacBaseUrl":"http://localhost:8080"}' > /tmp/cfg.json
host_sign POST /api/host/configurations/test-cfg /tmp/cfg.json
curl -X POST http://localhost:8090/api/host/configurations/test-cfg \
  -H "X-Valtimo-Timestamp: $TS" -H "X-Valtimo-Signature: $SIG" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/cfg.json

# Execute an action (signature binds the JSON body)
printf '%s' '{"configurationId":"test-cfg","processInstanceId":"p1","documentId":"d1","activityId":"a1","properties":{}}' > /tmp/action.json
host_sign POST /plugins/case-summary/0.1.0/actions/case-summary /tmp/action.json
curl -X POST http://localhost:8090/plugins/case-summary/0.1.0/actions/case-summary \
  -H "X-Valtimo-Timestamp: $TS" -H "X-Valtimo-Signature: $SIG" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/action.json
```

## Docker Deployment

```bash
cd app
npm run build
ADMIN_TOKEN=your-secret npm run docker:up
```

This starts both PostgreSQL and the Plugin Host. Plugin binaries persist to a Docker volume.

## Documentation

- [Plugin Host README](./app/README.md) — API reference, configuration, events
- [Plugin SDK README](./plugin-sdk/README.md) — Building plugins, SDK API
- [Case Summary Plugin](./sample-plugins/case-summary/README.md) — Example with GZAC callbacks
