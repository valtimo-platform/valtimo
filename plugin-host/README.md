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

### Starting a new plugin

The SDK scaffolds a complete, buildable plugin project in one command — `manifest.json`,
`package.json`, `tsconfig.json`, and `src/plugin.ts` with a registered action, plus an optional
`onEvent` handler and any of the six frontend bundle types:

```bash
# from plugin-host/, with the SDK already built (npm run setup does that)
node plugin-sdk/bin/valtimo-plugin-init.mjs ~/tmp/my-plugin --sdk "file:$PWD/plugin-sdk"
cd ~/tmp/my-plugin && npm run build:pack        # -> dist/my-plugin-0.1.0.zip
```

On a terminal it asks which bundles to generate; non-interactively, `--bundles` says the same thing:

```bash
node plugin-sdk/bin/valtimo-plugin-init.mjs ~/tmp/my-plugin --yes \
  --bundles config,case-tab,page --sdk "file:$PWD/plugin-sdk"
```

`--bundles all` gives one of every type, `--bundles none` gives a backend-only plugin, and the
default is `config` alone. `--sdk file:…` is needed for in-repo work because `@valtimo/plugin-sdk`
is not on npm yet; from a published SDK the command is
`npx --package @valtimo/plugin-sdk valtimo-plugin-init my-plugin` and the default `^<version>` range
resolves on its own. Upload the result with `npm run plugin:upload -- <zip>`. See the
[SDK README](./plugin-sdk/README.md#valtimo-plugin-init) for the wizard, the flags, and what each
bundle generates.

`sample-plugins/case-summary` is the reference for everything the scaffold deliberately leaves out:
`gzacApi` callbacks into GZAC, outbound `http_request` with egress grants, the `kv` store, several
bundles of the same type, and the other two levels of task-form submission.

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
ADMIN_TOKEN=your-secret npm run docker:up
```

This starts both PostgreSQL and the Plugin Host. Plugin binaries persist to a Docker volume.

The image compiles itself — no local `npm run build` first. Its build context is this directory
(`plugin-host/`), not `app/`, because the app depends on the SDK through `file:../plugin-sdk` and
the SDK is built inside the image:

```bash
docker build -f app/Dockerfile -t valtimo/plugin-host .
```

### Shipping plugins with the host

The image contains **no plugins**: `/data/preinstalled` is empty. Every `.zip` found in that
directory at boot is installed, so an operator provisions a host without any admin clicking Upload —
either by mounting a directory of packages over it:

```yaml
volumes:
  - ./my-plugins:/data/preinstalled:ro
```

or by baking them into a derived image:

```dockerfile
FROM valtimo/plugin-host
COPY my-plugin-1.0.0.zip /data/preinstalled/
```

A version already installed with identical content is a no-op on restart. A version already
installed with *different* content is kept, not replaced — GZAC pins the content hash an admin
accepted, so replacing it is an explicit decision (`PLUGIN_PREINSTALL_OVERWRITE=true` opts out, for
throwaway environments only). See [`app/README.md`](./app/README.md) for both settings.

## Documentation

- [Plugin Host README](./app/README.md) — API reference, configuration, events
- [Plugin SDK README](./plugin-sdk/README.md) — Building plugins, SDK API
- [`valtimo-plugin-init`](./plugin-sdk/README.md#valtimo-plugin-init) — Scaffolding a new plugin project
- [Case Summary Plugin](./sample-plugins/case-summary/README.md) — Example with GZAC callbacks
