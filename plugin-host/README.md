# Valtimo External Plugin System

WebAssembly-based plugin system for extending Valtimo GZAC with custom actions and event handlers.

## Components

| Directory | Description |
|-----------|-------------|
| [`app/`](./app/) | **Plugin Host** — Node.js sidecar that loads, stores, and executes Wasm plugins |
| [`plugin-sdk/`](./plugin-sdk/) | **SDK** — TypeScript library and build tools for plugin authors |
| [`sample-plugins/`](./sample-plugins/) | **Sample plugins** — Reference implementations |
| [`sample-apps/`](./sample-apps/) | **Sample apps** — Reference remote "Valtimo App" (demo-app) |
| `scripts/` | **Bootstrap tooling** — `npm run setup` / `npm run dev` orchestration (see Quick Start) |

> **Testing:** see [`TESTING.md`](./TESTING.md) for the test layers (unit, component, Wasm,
> integration, contract), how to run them, and **which kind of test to write when** you change code.

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

Prerequisites: **Node.js 22+** ([`.nvmrc`](./.nvmrc) provided) and **Docker** (for the host's
PostgreSQL). Everything else — including the Wasm toolchain (`extism-js` + `binaryen`) — is
installed automatically. Works on Linux, macOS, and Windows.

```bash
cd plugin-host
npm run dev
```

That single command takes a fresh checkout to a running host:

1. Installs and builds every package in dependency order (`plugin-sdk` first — the app, sample
   plugin, demo app, and test fixture all consume it as a `file:` dependency, so it must be built
   before anything else)
2. Downloads the Wasm toolchain into `.bin/` unless `extism-js`/`wasm-merge`/`wasm-opt` are
   already on your `PATH`
3. Compiles and packs the sample plugin (`case-summary`)
4. Starts PostgreSQL (docker compose) and the host with auto-reload on `http://localhost:8090`
5. Uploads the sample plugin over the HMAC-signed admin API

Re-runs skip whatever is already done. To install & build without starting anything (no Docker
needed), run `npm run setup`.

### Root commands

| Command | What it does |
|---|---|
| `npm run setup` | Install + build all packages, provision the toolchain, pack the sample plugin (append `-- --ci` for `npm ci`) |
| `npm run dev` | `setup` if needed, then start PostgreSQL + the host and upload the sample plugin (`-- --no-sample` to skip) |
| `npm run plugin:upload -- <zip>` | Upload a plugin package to the running host (signed, cross-platform; defaults to the sample plugin) |
| `npm run sample:build` | Rebuild + repack the sample plugin |
| `npm test` / `npm run test:wasm` / `npm run test:int` | Run the package test suites (see [`TESTING.md`](./TESTING.md)) |
| `npm run db:up` / `db:down` / `db:reset` | Manage the PostgreSQL container |
| `npm run clean` / `npm run clean:deep` | Remove build output (`clean:deep` also removes `node_modules` and the downloaded toolchain) |

Each package also remains usable on its own — see [`app/README.md`](./app/README.md) and
[`plugin-sdk/README.md`](./plugin-sdk/README.md) — as long as the SDK is installed and built first.

### Calling the admin API by hand

`npm run plugin:upload` performs the signed upload for you on any OS. When you want to explore the
API directly (or script against it from a unix shell), this is the scheme:

Every GZAC→host request is HMAC-SHA256 signed (not a bearer token): the signature covers
`{METHOD}\n{path}\n{timestamp}\n{bodyHash}` keyed with the `ADMIN_TOKEN`, sent as `X-Valtimo-Signature`
+ `X-Valtimo-Timestamp`. Replay protection is two-layered: the timestamp must be within ±5 minutes
of the host's clock, and on side-effecting routes (POST/PUT/DELETE) each accepted signature is
single-use within that window — resending a captured request verbatim is refused with 401. The
plugin upload signs the file bytes; other write routes sign the request body. HMAC authenticates and integrity-binds each request but does not
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
