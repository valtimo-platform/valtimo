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

/** Kept in step with the plugin host's own floor (`app/src/models/app-config.ts`). */
export const MIN_ADMIN_TOKEN_LENGTH = 16;

/**
 * An app needs far less configuration than a full plugin host: it has no plugin storage, no
 * database, and learns its broker (if any) from the configuration GZAC pushes. All it needs is a
 * port and the shared secret GZAC signs its requests with.
 */
export const envSchema = z.object({
  PORT: z.coerce.number().default(8095),

  // The shared secret GZAC uses as the HMAC key for every GZAC→app request. Must equal the
  // "secret" entered when the app is registered in GZAC. Same 16-character floor the plugin host
  // enforces — an app is the other end of the identical HMAC scheme.
  ADMIN_TOKEN: z
    .string()
    .min(
      MIN_ADMIN_TOKEN_LENGTH,
      `ADMIN_TOKEN must be at least ${MIN_ADMIN_TOKEN_LENGTH} characters ` +
        `(generate one with: openssl rand -hex 32)`
    ),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Identity used to name this app's event queue on GZAC's fanout exchange, mirroring the plugin
  // host's HOST_ID. Distinct ids each receive a copy of every event; replicas sharing an id
  // load-balance. Defaults to the OS hostname.
  HOST_ID: z.string().min(1).default(() => hostname()),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
  return envSchema.parse(process.env);
}
