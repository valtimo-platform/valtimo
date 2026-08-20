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

import {createHash, createHmac} from "node:crypto";
import Fastify, {type FastifyInstance, type FastifyServerOptions} from "fastify";
import rawBody from "fastify-raw-body";
import multipart from "@fastify/multipart";
import type {AppConfig} from "../models/index.js";

/** Shared secret used across route tests — the HMAC key for GZAC→host authentication. */
export const ADMIN_TOKEN = "test-admin-secret";

/**
 * Builds a Fastify instance wired exactly like production (raw-body capture for HMAC + multipart for
 * uploads), then invokes the caller to register the routes under test. Logging is off by default so
 * specs stay quiet; pass `opts.logger` (e.g. a level + capture stream) to assert on emitted lines.
 */
export async function buildTestApp(
  register: (app: FastifyInstance) => Promise<void>,
  opts: { logger?: FastifyServerOptions["logger"] } = {}
): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });
  await app.register(rawBody, {
    field: "rawBody",
    global: false,
    encoding: false,
    runFirst: true,
  });
  await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } });
  await register(app);
  await app.ready();
  return app;
}

/**
 * Produces the HMAC headers a legitimate GZAC client would send. Uses node:crypto directly (an
 * independent signer from the host's own hmac.ts) over the canonical
 * `{METHOD}\n{path}\n{timestamp}\n{bodyHash}` string, so a route+hook test proves the hook accepts a
 * genuinely-signed request rather than one produced by the code under test.
 */
export function signHeaders(
  method: string,
  path: string,
  body: Buffer | string = Buffer.alloc(0),
  secret: string = ADMIN_TOKEN,
  timestamp: string = new Date().toISOString()
): Record<string, string> {
  const bodyBuffer = typeof body === "string" ? Buffer.from(body, "utf8") : body;
  const bodyHash = createHash("sha256").update(bodyBuffer).digest("hex");
  const payload = `${method.toUpperCase()}\n${path}\n${timestamp}\n${bodyHash}`;
  const signature = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  return {
    "x-valtimo-signature": signature,
    "x-valtimo-timestamp": timestamp,
  };
}

/** A minimal AppConfig for route tests. Only the fields the routes actually read need be real. */
export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    PORT: 8090,
    ADMIN_TOKEN,
    PLUGIN_STORAGE_DIR: "./plugins",
    LOG_LEVEL: "info",
    HOST_ID: "test-host",
    DB_HOST: "localhost",
    DB_PORT: 5434,
    DB_NAME: "pluginhost",
    DB_USER: "pluginhost",
    DB_PASSWORD: "pluginhost",
    WASM_TIMEOUT_MS: 30_000,
    WASM_MAX_MEMORY_PAGES: 4096,
    WASM_INSTANCE_IDLE_TTL_MS: 10 * 60 * 1000,
    GZAC_API_TIMEOUT_MS: 60_000,
    USER_TOKEN_INTROSPECTION_TIMEOUT_MS: 10_000,
    UPLOAD_MAX_BYTES: 25 * 1024 * 1024,
    DATA_RATE_LIMIT_PER_MINUTE: 120,
    CONFIG_CACHE_TTL_MS: 10_000,
    ...overrides,
  } as AppConfig;
}
