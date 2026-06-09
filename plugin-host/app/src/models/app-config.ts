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
});

export type AppConfig = z.infer<typeof envSchema>;
