<!--
  Copyright 2015-2026 Ritense BV, the Netherlands.
  Licensed under EUPL, Version 1.2 (the "License");
  https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
-->

# Plugin host configuration & deployment

> **Audience:** operators running the plugin host as a service. (Contributors working in the
> Valtimo repository: `cd plugin-host && npm run dev` is the local one-liner — see the
> [plugin-host README](../README.md).) Full reference: [app README](../app/README.md).

The plugin host is a stateless-ish Node.js service (Fastify + Extism) with its own PostgreSQL
database. It stores plugin packages on disk, persists configurations/KV/logs in PostgreSQL, and
holds **no GZAC-side configuration at all** — every credential, grant, and broker detail arrives
in the configuration pushes from GZAC.

## Running with Docker

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

## Environment reference

Required:

| Variable | Purpose |
|---|---|
| `ADMIN_TOKEN` | The shared secret GZAC signs every request with (HMAC; only the `/health` probe is unsigned). The value the admin enters as **Secret** when adding the host. |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | The host's own PostgreSQL. All five default to the local dev database (`localhost:5434`, `pluginhost`/`pluginhost`) — always set them explicitly in a deployment. The dev compose maps host port **5434**; in-network it is 5432. |

Common:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8090` | HTTP(S) listen port |
| `PLUGIN_STORAGE_DIR` | `./plugins` (`/data/plugins` in the image) | Where installed packages live (persist this) |
| `DB_MIGRATE_ON_BOOT` | `true` | Apply pending migrations at boot. Set `false` when a pre-deploy job or init container runs `node dist/migrate.js` from the same image. Only `true`/`false` accepted — anything else fails the boot |
| `HOST_ID` | OS hostname | Event-queue identity — see **Scaling** below |
| `TLS_CERT_PATH` / `TLS_KEY_PATH` (+ `TLS_CA_PATH`) | unset | Set both to serve HTTPS. Required for any non-loopback host: GZAC refuses to register or repoint to a plain-HTTP remote address — the configuration push carries a service token, decrypted secret properties and any broker credentials — unless the GZAC deployment explicitly opts out (see the GZAC-side switches under Operational notes) |
| `TRUST_PROXY` | `false` | Honour `X-Forwarded-For` for client addresses. Enable behind a reverse proxy so the per-IP rate limits key on the real client instead of the proxy |
| `PLUGIN_PREINSTALL_DIR` | `./preinstalled` | Boot-time package directory (`/data/preinstalled` in the image) |
| `PLUGIN_PREINSTALL_OVERWRITE` | `false` | Replace an installed version whose content differs — throwaway environments only |
| `LOG_LEVEL` / `LOG_RETENTION_DAYS` | `info` / `30` | Logging and `plugin_logs` retention (cleanup runs 6-hourly) |

Execution and abuse bounds (defaults are sane; tune deliberately):

| Variable | Default | Purpose |
|---|---|---|
| `WASM_TIMEOUT_MS` | 30 s | Hard wall-clock cap per plugin call |
| `WASM_MAX_MEMORY_PAGES` | 4096 (= 256 MiB) | Per-instance guest memory cap (0 uncaps) |
| `WASM_POOL_MIN_INSTANCES` / `WASM_POOL_MAX_INSTANCES` | 1 / 10 | Per-plugin-version instance pool; worst-case memory ≈ max × page cap. Set max to 1 for strictly serialised calls |
| `WASM_POOL_ACQUIRE_TIMEOUT_MS` | 30 s | Max wait for a free instance under load |
| `WASM_INSTANCE_IDLE_TTL_MS` | 10 min | Idle instances are evicted; a quiet host returns to zero |
| `GZAC_API_TIMEOUT_MS` | 60 s | Bound on plugin→GZAC callbacks |
| `UPLOAD_MAX_BYTES` | 100 MiB | Package size cap |
| `DATA_RATE_LIMIT_PER_MINUTE` | 120 | Per-configuration rate limit on the public `/data` route |
| `ADMIN_RATE_LIMIT_PER_MINUTE` | 120 | Per-IP budget for the HMAC-authenticated admin routes; throttles online brute-force of `ADMIN_TOKEN` (legitimate traffic is one poll per minute). 0 disables |
| `BUNDLE_RATE_LIMIT_PER_MINUTE` | 600 | Per-IP budget for the public bundle/logo/manifest routes, bounding disk-read abuse. 0 disables |
| `USER_TOKEN_INTROSPECTION_TIMEOUT_MS` | 10 s | Bound on the `/data` token check against GZAC |
| `CONFIG_CACHE_TTL_MS` | 10 s | Config read-cache; also bounds cross-replica visibility of pushes |

Security-posture switches:

| Variable | Default | Purpose |
|---|---|---|
| `HOST_ALLOWED_INTERNAL_CIDRS` | unset | Comma-separated CIDRs plugins may reach despite being private address space — the **production** way to allow an internal service. Keep entries narrow (a `/32` or a specific ClusterIP); in Kubernetes prefer a NetworkPolicy. `169.254.0.0/16` (cloud metadata) is never allowlistable |
| `HOST_ALLOW_HTTP` | `false` | Allow plain-http egress targets — local development only |
| `HOST_ALLOW_PRIVATE_NETWORK` | `false` | Disables the SSRF classifier wholesale — local development only, logs a loud warning |
| `ALLOWED_FRAME_ANCESTORS` | unset | Extra browser origins allowed to frame plugin screens, on top of what connected GZACs announce |
| `FRAME_ANCESTOR_STALE_MS` | 7 days | How long an announced GZAC stays in the frame allowlist without re-announcing |

**No broker variables.** The host never configures RabbitMQ itself — broker details arrive per
configuration from GZAC.

## Shipping plugins with the host

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
see [Auto-deployment](./auto-deployment.md).

## Scaling and replicas

- **Replicas of one host** share the database, the package storage, and the same `HOST_ID`: they
  form a competing-consumer group — each event is handled by exactly one replica.
- **Distinct hosts** (different `HOST_ID`) each receive a copy of every event.
- Configuration pushes land in the shared database; other replicas see them within
  `CONFIG_CACHE_TTL_MS`.
- All rate limits are per replica — the per-configuration `/data` budget and the per-IP admin
  and bundle budgets alike; effective limits multiply by replica count behind a load balancer.
- With multiple replicas and `DB_MIGRATE_ON_BOOT=true`, one replica wins the migration advisory
  lock while the others wait — the pre-deploy migration job avoids the stampede.

## Operational notes

- **GZAC-side switches.** Two Spring properties on the GZAC deployment govern which hosts may be
  connected at all: `valtimo.external-plugin.allowed-host-origins` (comma-separated
  `scheme://host[:port]` entries; `*.example.com` matches subdomains but not the bare apex; empty =
  unrestricted) confines registration and repointing to known addresses, and
  `valtimo.external-plugin.allow-plaintext-host-transport=true` re-allows plain-HTTP remote hosts
  on a fully trusted network. The transport check defaults to strict (plaintext refused); the
  origin allowlist defaults to empty, i.e. unrestricted — set it explicitly to get the
  confinement.
- **Secret rotation is two-sided.** The host reads `ADMIN_TOKEN` once at boot. Order that
  minimises the outage: restart the host with the new token first (GZAC's pushes fail as
  warnings, the host may show Unreachable), then update the secret on the GZAC side via **Edit
  connection** — the next poll reconnects and re-pushes everything. The rotation also revokes
  every token previously issued for the host's configurations; the re-push hands out fresh ones,
  so a leaked or hoarded token dies while the host itself recovers without further action.
  Re-entering the unchanged secret does not count as a rotation and revokes nothing.
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
- **Never point a database-cloned GZAC environment at the same host as its source** — clones
  share configuration ids and will fight over the same rows.
- The `/health` endpoint is a liveness probe only; GZAC's **Connected** status means the full
  authenticated cycle succeeded, which is the signal that matters.
