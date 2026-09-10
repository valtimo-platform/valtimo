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

import type {FastifyInstance} from "fastify";
import rateLimit from "@fastify/rate-limit";

/**
 * Applies a per-IP request budget (429 above it) to every route registered after this call in the
 * calling route group's scope — call it before the routes.
 *
 * Registered per route group rather than app-wide so each surface carries its own budget and the
 * hot plugin-invocation paths (actions, submits, `/data` with its own per-configuration limiter)
 * stay unthrottled. The check runs on `onRequest`, before body parsing and the HMAC hook, so
 * hammering the authentication with guesses is what gets cut off first. Counters are in-memory and
 * per replica; `request.ip` follows the real client only when `TRUST_PROXY` is enabled.
 */
export async function registerRouteRateLimit(
  fastify: FastifyInstance,
  maxPerMinute: number | undefined
): Promise<void> {
  if (!maxPerMinute || maxPerMinute <= 0) return;
  await fastify.register(rateLimit, {
    max: maxPerMinute,
    timeWindow: 60_000,
  });
}
