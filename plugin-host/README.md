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

```bash
# Upload plugin
curl -X POST http://localhost:8090/api/host/plugins \
  -H "Authorization: Bearer test-secret" \
  -F "file=@sample-plugins/case-summary/dist/case-summary-0.1.0.zip"

# Push a configuration
curl -X POST http://localhost:8090/api/host/configurations/test-cfg \
  -H "Authorization: Bearer test-secret" \
  -H "Content-Type: application/json" \
  -d '{"pluginId":"case-summary","pluginVersion":"0.1.0","properties":{"titleField":"/name"},"serviceToken":"test","gzacBaseUrl":"http://localhost:8080"}'

# Execute an action
curl -X POST http://localhost:8090/plugins/case-summary/0.1.0/actions/case-summary \
  -H "Content-Type: application/json" \
  -d '{"configurationId":"test-cfg","processInstanceId":"p1","documentId":"d1","activityId":"a1","properties":{}}'
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
