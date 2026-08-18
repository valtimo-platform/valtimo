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

import { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import { FrameAncestorRegistry, normalizeOrigins } from "../frame-ancestor-registry.js";
import { createHmacAuthHook } from "../security/hmac-auth.js";

const gzacInstanceSchema = z.object({
  gzacBaseUrl: z.string().min(1),
  frontendOrigins: z.array(z.string()).default([]),
});

/**
 * GZAC instance registration.
 *
 * `PUT /api/host/gzac-instances` — a GZAC instance announces itself and the browser origins allowed
 * to embed this host's plugin screens. GZAC calls this on host registration, when an admin edits the
 * origins, and on every discovery poll, so the call is idempotent and the allowlist is self-healing:
 * a newly connected GZAC becomes framable within one poll cycle without restarting either side.
 *
 * Authentication is the same HMAC scheme as the configuration push, with `rawBody` capture so the
 * signature binds the exact bytes of the announced allowlist — an attacker who could rewrite this
 * body in flight could otherwise add their own origin to `frame-ancestors`.
 */
export async function hostGzacInstanceRoutes(
  fastify: FastifyInstance,
  opts: { frameAncestorRegistry: FrameAncestorRegistry; config: AppConfig }
): Promise<void> {
  const { frameAncestorRegistry, config } = opts;

  fastify.addHook("preHandler", createHmacAuthHook(config.ADMIN_TOKEN));

  fastify.put(
    "/api/host/gzac-instances",
    { config: { rawBody: true } },
    async (request, reply) => {
      const parsed = gzacInstanceSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: "Invalid body: expected {gzacBaseUrl, frontendOrigins[]}" });
        return;
      }

      const { gzacBaseUrl } = parsed.data;
      // Anything that is not a bare http(s) origin is dropped rather than rejected: the push is a
      // side effect of the discovery poll, and failing it would cost the instance its whole
      // registration (including the origins that *are* valid) every cycle.
      const frontendOrigins = normalizeOrigins(parsed.data.frontendOrigins);
      const dropped = parsed.data.frontendOrigins.length - frontendOrigins.length;
      if (dropped > 0) {
        request.log.warn(
          { gzacBaseUrl, dropped },
          "Ignored frontend origins that are not a bare http(s) origin"
        );
      }

      await frameAncestorRegistry.register(gzacBaseUrl, frontendOrigins);

      request.log.info(
        { gzacBaseUrl, frontendOrigins },
        "GZAC instance registered as a permitted frame ancestor"
      );
      reply.code(200).send({ gzacBaseUrl, frontendOrigins });
    }
  );
}
