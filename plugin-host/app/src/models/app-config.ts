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
  // memory (64 KiB per page — the default 4096 pages = 256 MiB). Set WASM_MAX_MEMORY_PAGES=0 to
  // remove the cap (not recommended outside local development).
  WASM_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  WASM_MAX_MEMORY_PAGES: z.coerce.number().int().min(0).default(4096),
  // Idle Extism instances are closed after this long without a call (a periodic sweep frees the
  // worker + memory; the next call transparently re-instantiates). 0 disables eviction.
  WASM_INSTANCE_IDLE_TTL_MS: z.coerce.number().int().min(0).default(10 * 60 * 1000),

  // Upper bound on the gzac_api callback fetch — matches http_request's hard cap so a hung GZAC
  // endpoint cannot pin a plugin call (and its per-plugin lock) forever.
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

  // Database configuration
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().default(5434),
  DB_NAME: z.string().default("pluginhost"),
  DB_USER: z.string().default("pluginhost"),
  DB_PASSWORD: z.string().default("pluginhost"),

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
