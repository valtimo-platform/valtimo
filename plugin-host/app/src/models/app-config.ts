/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { hostname } from "node:os";
import { z } from "zod";

export const envSchema = z.object({
  PORT: z.coerce.number().default(8090),
  ADMIN_TOKEN: z.string().min(1),
  PLUGIN_STORAGE_DIR: z.string().default("./plugins"),

  // Directory scanned once at boot for plugin packages (.zip) to install — how an operator ships
  // the plugins a host should serve without an admin uploading them: bake the zips into the image,
  // or mount a directory over this path (the published image ships it empty). A version already
  // installed with identical content is a no-op; one with *different* content is kept, not
  // replaced, because GZAC pins the hash an admin accepted. PLUGIN_PREINSTALL_OVERWRITE=true drops
  // that rule for throwaway environments — never set it where an admin has accepted a package.
  PLUGIN_PREINSTALL_DIR: z.string().default("./preinstalled"),
  // Deliberately not z.coerce.boolean(): that maps every non-empty string (including "false") to
  // true. Only the literal string "true" enables the overwrite.
  PLUGIN_PREINSTALL_OVERWRITE: z
    .string()
    .optional()
    .transform((value) => (value ?? "").trim().toLowerCase() === "true"),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  // Event delivery is not configured on the host: each GZAC instance pushes its own broker
  // (amqpUrl/exchange) alongside every configuration, and the host opens one consumer per broker.
  //
  // Identity of this logical host. Used to name the per-host event queue so that, on a fanout
  // exchange, every distinct host bound to the same GZAC instance receives its own copy of each
  // event. Replicas of the SAME host must share one HOST_ID so they load-balance (process each
  // event once) instead of each handling it. Defaults to the OS hostname.
  HOST_ID: z.string().min(1).default(() => hostname()),

  // Wasm execution limits. Every plugin call is bounded by WASM_TIMEOUT_MS (Extism cancels the
  // call and the route reports a HOST_ERROR); WASM_MAX_MEMORY_PAGES caps the module's linear
  // memory (64 KiB per page — the default 4096 pages = 256 MiB). The cap is applied by rewriting
  // the module's own memory declaration at instantiation, which is the only bound the engine
  // enforces on guest memory growth. Set WASM_MAX_MEMORY_PAGES=0 to remove the cap (not
  // recommended outside local development).
  WASM_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  WASM_MAX_MEMORY_PAGES: z.coerce.number().int().min(0).default(4096),
  // Idle Extism instances are closed after this long without a call (a periodic sweep frees the
  // worker + memory; the next call transparently re-instantiates). 0 disables eviction.
  WASM_INSTANCE_IDLE_TTL_MS: z.coerce.number().int().min(0).default(10 * 60 * 1000),

  // Per-plugin Wasm instance pool. Each Extism instance has its own linear memory and worker
  // thread, so calls to one plugin run in parallel instead of queueing behind each other. Instances
  // above the minimum are closed as soon as they finish; when every instance up to the maximum is
  // busy, further calls wait up to WASM_POOL_ACQUIRE_TIMEOUT_MS and then fail rather than queueing
  // without bound. The worst-case memory footprint per plugin version is WASM_POOL_MAX_INSTANCES x
  // WASM_MAX_MEMORY_PAGES. Set WASM_POOL_MAX_INSTANCES=1 for strictly serialised calls.
  WASM_POOL_MIN_INSTANCES: z.coerce.number().int().min(1).default(1),
  WASM_POOL_MAX_INSTANCES: z.coerce.number().int().min(1).default(10),
  WASM_POOL_ACQUIRE_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

  // Upper bound on the gzac_api callback fetch — matches http_request's hard cap so a hung GZAC
  // endpoint cannot pin a plugin call (and the pooled Wasm instance it holds) forever.
  GZAC_API_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),

  // Upper bound on the user-token introspection call the /data route makes against GZAC before
  // executing Wasm. Deliberately shorter than GZAC_API_TIMEOUT_MS: introspection happens on the
  // request path of a public route, so a hung GZAC should fail the request (503, fail closed)
  // quickly rather than pin it for a minute.
  USER_TOKEN_INTROSPECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

  // Maximum accepted plugin package (.zip) upload size in bytes. The multipart parser enforces
  // this before the file is buffered for the HMAC check.
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(25 * 1024 * 1024),

  // Per-configuration rate limit for the public /plugins/:id/:version/data route (requests per
  // minute per configurationId). 0 disables the limit.
  DATA_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(0).default(120),

  // How long the ConfigRegistry serves configurations from its in-memory cache before re-reading
  // Postgres. Writes through this host invalidate immediately; pushes handled by ANOTHER replica
  // are picked up after at most this TTL. 0 disables caching.
  CONFIG_CACHE_TTL_MS: z.coerce.number().int().min(0).default(10_000),

  // Extra browser origins allowed to frame plugin bundles, on top of those registered by GZAC
  // instances. Escape hatch for local development, and for frontends that no GZAC announces (a
  // separate portal, a proxy alias). Comma-separated `scheme://host[:port]` list.
  ALLOWED_FRAME_ANCESTORS: z.string().optional(),
  // A GZAC instance that has not re-announced itself within this window drops out of the
  // frame-ancestors allowlist. There is no deregistration call, so this is what eventually removes a
  // decommissioned GZAC. Comfortably longer than the discovery poll (60 s) so a GZAC that is merely
  // down for maintenance does not lose its plugins' framability.
  FRAME_ANCESTOR_STALE_MS: z.coerce.number().int().positive().default(7 * 24 * 60 * 60 * 1000),

  // Database configuration
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().default(5434),
  DB_NAME: z.string().default("pluginhost"),
  DB_USER: z.string().default("pluginhost"),
  DB_PASSWORD: z.string().default("pluginhost"),
  // Whether the app applies pending migrations during boot. Default true keeps `docker compose up`
  // and `npm run dev` zero-step. Set false when migrations run as a pre-deploy job or init container
  // (`node dist/migrate.js`), so a rolling deploy puts the schema ahead of every replica at a known
  // moment rather than whichever pod wins the advisory lock.
  //
  // An explicit two-value enum rather than a looser truthy check: this flag decides whether the
  // schema gets maintained, so a typo should fail the boot rather than silently pick a default.
  DB_MIGRATE_ON_BOOT: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  // Optional TLS termination. Set TLS_CERT_PATH and TLS_KEY_PATH (PEM files) together to make the
  // host serve HTTPS, so the GZAC→host configuration push — which carries the broker AMQP URL,
  // its credentials, and the per-config service token — is encrypted on the wire rather than only
  // HMAC-authenticated. TLS_CA_PATH supplies the intermediate/CA chain when the certificate file
  // is not already self-contained. Leave all three unset to serve plain HTTP (local development,
  // or when TLS is terminated by a reverse proxy in front of the host).
  TLS_CERT_PATH: z.string().optional(),
  TLS_KEY_PATH: z.string().optional(),
  TLS_CA_PATH: z.string().optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

/**
 * The subset of the environment the standalone migrate entry point needs. Narrower than envSchema on
 * purpose: that schema requires ADMIN_TOKEN, and a migration job has no business being handed the
 * HMAC admin secret. Picking keeps one definition of each variable's type and default.
 */
export const migrateEnvSchema = envSchema.pick({
  DB_HOST: true,
  DB_PORT: true,
  DB_NAME: true,
  DB_USER: true,
  DB_PASSWORD: true,
  LOG_LEVEL: true,
});

export type MigrateConfig = z.infer<typeof migrateEnvSchema>;
