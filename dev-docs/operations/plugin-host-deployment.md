<!--
  Copyright 2015-2026 Ritense BV, the Netherlands.
  Licensed under EUPL, Version 1.2 (the "License");
  https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
-->

# Plugin host configuration & deployment

> **Audience:** operators running the plugin host as a service. (Contributors working in the
> Valtimo repository: `cd plugin-host && npm run dev` is the local one-liner — see the
> [plugin-host README](../../plugin-host/README.md).) Full reference: [app README](../../plugin-host/app/README.md).

The plugin host is a stateless-ish Node.js service (Fastify + Extism) with its own PostgreSQL
database. It stores plugin packages on disk, persists configurations/KV/logs in PostgreSQL, and
holds **no GZAC-side configuration at all** — every credential, grant, and broker detail arrives
in the configuration pushes from GZAC.

## Overview

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   GZAC (Java)   │◀───────▶│   Plugin Host   │◀───────▶│   PostgreSQL    │
│                 │  HMAC   │   (Node.js)     │         │   (host's DB)   │
└─────────────────┘         └─────────────────┘         └─────────────────┘
                                    │
                                    ▼
                            ┌─────────────────┐
                            │  /data/plugins  │
                            │  (package store)│
                            └─────────────────┘
```

The host receives configuration pushes from GZAC every ~60 seconds, including service tokens,
granted permissions, and broker details. It runs Wasm plugins in sandboxes and serves frontend
bundles to the browser.

## Prerequisites

- Docker (or Kubernetes)
- PostgreSQL 14+ (dedicated database for the host)
- Network connectivity between GZAC, the plugin host, and PostgreSQL
- (Optional) TLS certificates for HTTPS — required for non-loopback deployments
- (Optional) RabbitMQ if plugins consume platform events

## Configuration

### Required

| Variable | Type | Description |
|----------|------|-------------|
| `ADMIN_TOKEN` | string | The shared secret GZAC signs every request with (HMAC). The value the admin enters as **Secret** when adding the host. |
| `DB_HOST` | string | PostgreSQL hostname |
| `DB_PORT` | string | PostgreSQL port (default: 5432) |
| `DB_NAME` | string | Database name |
| `DB_USER` | string | Database user |
| `DB_PASSWORD` | string | Database password |

### Optional

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PORT` | number | `8090` | HTTP(S) listen port |
| `PLUGIN_STORAGE_DIR` | string | `/data/plugins` | Where installed packages live (persist this) |
| `DB_MIGRATE_ON_BOOT` | boolean | `true` | Apply pending migrations at boot. Set `false` when a pre-deploy job runs migrations. |
| `HOST_ID` | string | OS hostname | Event-queue identity — replicas of one host must share this value |
| `TLS_CERT_PATH` | string | unset | Path to TLS certificate. Required for non-loopback hosts. |
| `TLS_KEY_PATH` | string | unset | Path to TLS private key |
| `TLS_CA_PATH` | string | unset | Path to CA certificate (optional) |
| `TRUST_PROXY` | boolean | `false` | Honour `X-Forwarded-For` for client addresses. Enable behind a reverse proxy. |
| `PLUGIN_PREINSTALL_DIR` | string | `/data/preinstalled` | Boot-time package directory |
| `PLUGIN_PREINSTALL_OVERWRITE` | boolean | `false` | Replace an installed version whose content differs — throwaway environments only |
| `LOG_LEVEL` | string | `info` | Logging level |
| `LOG_RETENTION_DAYS` | number | `30` | `plugin_logs` retention (cleanup runs 6-hourly) |
| `WASM_TIMEOUT_MS` | number | `30000` | Hard wall-clock cap per plugin call |
| `WASM_MAX_MEMORY_PAGES` | number | `4096` | Per-instance guest memory cap (4096 = 256 MiB; 0 uncaps) |
| `WASM_POOL_MIN_INSTANCES` | number | `1` | Per-plugin-version instance pool minimum |
| `WASM_POOL_MAX_INSTANCES` | number | `10` | Per-plugin-version instance pool maximum |
| `WASM_POOL_ACQUIRE_TIMEOUT_MS` | number | `30000` | Max wait for a free instance under load |
| `WASM_INSTANCE_IDLE_TTL_MS` | number | `600000` | Idle instances are evicted; a quiet host returns to zero |
| `GZAC_API_TIMEOUT_MS` | number | `60000` | Bound on plugin→GZAC callbacks |
| `UPLOAD_MAX_BYTES` | number | `104857600` | Package size cap (100 MiB) |
| `DATA_RATE_LIMIT_PER_MINUTE` | number | `120` | Per-configuration rate limit on the public `/data` route |
| `ADMIN_RATE_LIMIT_PER_MINUTE` | number | `120` | Per-IP budget for HMAC-authenticated admin routes |
| `BUNDLE_RATE_LIMIT_PER_MINUTE` | number | `600` | Per-IP budget for public bundle/logo/manifest routes |
| `USER_TOKEN_INTROSPECTION_TIMEOUT_MS` | number | `10000` | Bound on the `/data` token check against GZAC |
| `CONFIG_CACHE_TTL_MS` | number | `10000` | Config read-cache; also bounds cross-replica visibility of pushes |
| `HOST_ALLOWED_INTERNAL_CIDRS` | string | unset | Comma-separated CIDRs plugins may reach despite being private address space |
| `HOST_ALLOW_HTTP` | boolean | `false` | Allow plain-http egress targets — local development only |
| `HOST_ALLOW_PRIVATE_NETWORK` | boolean | `false` | Disables the SSRF classifier — local development only |
| `ALLOWED_FRAME_ANCESTORS` | string | unset | Extra browser origins allowed to frame plugin screens |
| `FRAME_ANCESTOR_STALE_MS` | number | `604800000` | How long an announced GZAC stays in the frame allowlist (7 days) |

### Example Configuration

```bash
# .env
ADMIN_TOKEN=your-strong-shared-secret
DB_HOST=db
DB_PORT=5432
DB_NAME=pluginhost
DB_USER=pluginhost
DB_PASSWORD=your-db-password
HOST_ID=plugin-host-prod
TLS_CERT_PATH=/tls/tls.crt
TLS_KEY_PATH=/tls/tls.key
```

## Deployment

### Docker

The host ships as the `valtimo/plugin-host` image (port 8090). A minimal deployment is the image
plus its own PostgreSQL:

```yaml
services:
  plugin-host:
    image: valtimo/plugin-host
    environment:
      ADMIN_TOKEN: ${ADMIN_TOKEN:?set a strong shared secret}
      DB_HOST: db
      DB_PORT: "5432"            # the in-network port — 5434 is only the dev compose host mapping
      DB_NAME: pluginhost
      DB_USER: pluginhost
      DB_PASSWORD: ${DB_PASSWORD:?}
      # HOST_ID: my-host         # replicas of one host must share this value
      # TLS_CERT_PATH: /tls/tls.crt   # required for any non-loopback GZAC connection
      # TLS_KEY_PATH: /tls/tls.key
    ports: ["8090:8090"]
    volumes:
      - plugin-storage:/data/plugins           # installed packages — must persist
      # - ./my-plugins:/data/preinstalled:ro   # packages installed at boot (see below)
    depends_on:
      db:
        condition: service_healthy
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: pluginhost
      POSTGRES_PASSWORD: ${DB_PASSWORD:?}
      POSTGRES_DB: pluginhost
    volumes:
      - plugin-host-db:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U pluginhost -d pluginhost"]
      interval: 5s
      timeout: 5s
      retries: 5
volumes:
  plugin-storage:
  plugin-host-db:
```

The image applies pending migrations at boot; in production prefer `DB_MIGRATE_ON_BOOT=false`
with a pre-deploy job or init container running `node dist/migrate.js` from the same image. The
image ships no plugins — `/data/preinstalled` starts empty (see
[Shipping plugins](#shipping-plugins-with-the-host)). Replicas of one host must share the
database, the `/data/plugins` volume, and `HOST_ID`.

Building from a checkout instead: `docker build -f app/Dockerfile -t valtimo/plugin-host .` from
`plugin-host/` — not `plugin-host/app/`; the context must contain `plugin-sdk/` — or
`cd plugin-host/app && ADMIN_TOKEN=your-secret npm run docker:up` for a local PostgreSQL + host
pair (note: the dev compose falls back to `ADMIN_TOKEN=changeme` when the variable is unset).

### Shipping plugins with the host

The published image contains **no plugins**. Every `.zip` in the pre-install directory is
installed at boot through the same validated pipeline as an upload:

```yaml
volumes:
  - ./my-plugins:/data/preinstalled:ro
```

or baked into a derived image:

```dockerfile
FROM valtimo/plugin-host
COPY my-plugin-1.0.0.zip /data/preinstalled/
```

An already-installed version with identical content is a no-op; one with **different** content is
kept, not replaced — GZAC pinned the content an admin accepted, so replacing code is an explicit
act (a new version, or an admin-confirmed overwrite). A corrupt package is skipped with a
warning; nothing in pre-install can stop the host from starting.

For declaring the GZAC side of an environment (integrations, uploads, configurations) in code,
see [Auto-deployment](../external-plugins/auto-deployment.md).

## Health Checks

| Endpoint | Expected | Description |
|----------|----------|-------------|
| `GET /health` | 200 | Liveness probe (unauthenticated). GZAC polls this every ~60 seconds. |

The `/health` endpoint is a liveness probe only; GZAC's **Connected** status means the full
authenticated cycle succeeded, which is the signal that matters.

## Scaling

### Horizontal Scaling

- **Replicas of one host** share the database, the package storage, and the same `HOST_ID`: they
  form a competing-consumer group — each event is handled by exactly one replica.
- **Distinct hosts** (different `HOST_ID`) each receive a copy of every event.
- Configuration pushes land in the shared database; other replicas see them within
  `CONFIG_CACHE_TTL_MS`.
- All rate limits are per replica — the per-configuration `/data` budget and the per-IP admin
  and bundle budgets alike; effective limits multiply by replica count behind a load balancer.
- With multiple replicas and `DB_MIGRATE_ON_BOOT=true`, one replica wins the migration advisory
  lock while the others wait — the pre-deploy migration job avoids the stampede.

### Resource Requirements

| Resource | Minimum | Recommended | Notes |
|----------|---------|-------------|-------|
| CPU | 0.5 | 2 | Depends on plugin workload |
| Memory | 512 MB | 2 GB | Worst-case: `WASM_POOL_MAX_INSTANCES` x `WASM_MAX_MEMORY_PAGES` x 64 KB |

Memory scales with concurrent plugin executions. The default pool (max 10 instances x 256 MiB)
can consume up to 2.5 GB under full load.

## Monitoring

### Logs

The host logs to stdout in JSON format. Key log messages:

```
{"level":"info","msg":"Plugin host started","port":8090}
{"level":"info","msg":"Configuration pushed","configurationId":"...","pluginId":"..."}
{"level":"warn","msg":"GZAC unreachable","gzacBaseUrl":"..."}
{"level":"error","msg":"Plugin execution failed","configurationId":"...","error":"..."}
```

Plugin-level logs (from `log.debug/info/warn/error()` calls) are stored in `plugin_logs` and
retained for `LOG_RETENTION_DAYS` (default 30). Administrators view them in the GZAC **Logs**
modal per configuration.

## Security Considerations

- **TLS required for non-loopback deployments.** GZAC refuses to register or repoint to a plain-HTTP
  remote address — the configuration push carries a service token, decrypted secret properties, and
  any broker credentials. Set `TLS_CERT_PATH` and `TLS_KEY_PATH`.
- **GZAC-side switches.** Two Spring properties govern which hosts may be connected:
  - `valtimo.external-plugin.allowed-host-origins` — comma-separated `scheme://host[:port]` entries;
    `*.example.com` matches subdomains but not the bare apex; empty = unrestricted. Set it explicitly
    to confine registration to known addresses.
  - `valtimo.external-plugin.allow-plaintext-host-transport=true` — re-allows plain-HTTP remote hosts
    on a fully trusted network (defaults to strict).
- **Secret rotation is two-sided.** The host reads `ADMIN_TOKEN` once at boot. Order that minimises
  the outage: restart the host with the new token first (GZAC's pushes fail as warnings, the host
  may show Unreachable), then update the secret on the GZAC side via **Edit connection** — the next
  poll reconnects and re-pushes everything. The rotation also revokes every token previously issued
  for the host's configurations.
- **SSRF protection.** Plugins cannot reach private address space by default. Use
  `HOST_ALLOWED_INTERNAL_CIDRS` (narrow CIDRs only) for internal services; in Kubernetes prefer
  NetworkPolicy. `169.254.0.0/16` (cloud metadata) is never allowlistable.
- **Never point a database-cloned GZAC environment at the same host as its source** — clones share
  configuration ids and will fight over the same rows.

## Troubleshooting

### Host shows "Unreachable" in GZAC

**Symptom:** The plugin host integration shows "Unreachable" status in the admin UI.

**Cause:** GZAC cannot complete the authenticated poll cycle.

**Resolution:**
- Verify network connectivity: can GZAC reach the host's URL?
- Check `ADMIN_TOKEN` matches between host and GZAC
- For non-loopback: verify TLS is configured
- Check host logs for HMAC verification failures

### Plugins not appearing after upload

**Symptom:** Plugin uploaded successfully but doesn't appear in the plugin list.

**Cause:** Discovery cycle hasn't run, or the plugin has validation errors.

**Resolution:**
- Wait up to 60 seconds for the next discovery poll
- Check host logs for manifest validation errors
- Verify the zip contains a valid `manifest.json`

### Secret rotation not taking effect

**Symptom:** After changing `ADMIN_TOKEN`, connections still fail.

**Cause:** The host reads `ADMIN_TOKEN` only at boot.

**Resolution:**
1. Restart the host with the new token (GZAC shows Unreachable)
2. Update the secret in GZAC via **Edit connection**
3. Wait for the next poll cycle to reconnect

## Operational Notes

- **Moving a host** (new address, new broker) is done from GZAC via **Edit connection**; the host
  itself needs no change. Repointing GZAC at a *different physical host* revokes all outstanding
  tokens and deletes the pushed configurations from the old address — best-effort, authenticated
  with the *old* admin token, right after the edit is saved. An old host that is unreachable at
  that moment keeps its rows (logged, not retried) — clean those manually if it ever comes back —
  but every token they carry has already been revoked.
- **Reverse proxies must forward the exact signed path**: the HMAC signature covers the request
  path, so a proxy may mount the host under a prefix only if it strips that prefix before
  forwarding — the host must see the same path GZAC signed. Root-mounted (the default) is fine;
  TLS termination is fine too.
- **No broker variables.** The host never configures RabbitMQ itself — broker details arrive per
  configuration from GZAC.
