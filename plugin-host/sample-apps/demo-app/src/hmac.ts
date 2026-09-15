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

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";

/**
 * GZAC→app request authentication, byte-for-byte compatible with the plugin host and GZAC's
 * `ExternalPluginHmacSigner`. Every GZAC→app call carries:
 *   - `X-Valtimo-Signature`: hex HMAC-SHA256, keyed by ADMIN_TOKEN, over the canonical string
 *   - `X-Valtimo-Timestamp`: an ISO-8601 instant, used for a ±5-minute replay window
 *
 * Canonical string: `{METHOD}\n{path}\n{timestamp}\n{sha256hex(body)}`, where `path` is the request
 * URL minus the query string, and `body` is the raw request bytes (an empty buffer for GET/DELETE).
 */
export const SIGNATURE_HEADER = "x-valtimo-signature";
export const TIMESTAMP_HEADER = "x-valtimo-timestamp";

const ALGORITHM = "sha256";
const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000; // 5 minutes

function computeSignature(secret: string, method: string, path: string, timestamp: string, bodyHash: string): string {
  const payload = `${method.toUpperCase()}\n${path}\n${timestamp}\n${bodyHash}`;
  return createHmac(ALGORITHM, secret).update(payload, "utf8").digest("hex");
}

function computeBodyHash(body: Buffer): string {
  return createHash(ALGORITHM).update(body).digest("hex");
}

export function verifyHmac(
  secret: string,
  method: string,
  path: string,
  signatureHeader: string | undefined,
  timestampHeader: string | undefined,
  body: Buffer,
): { valid: boolean; error?: string } {
  if (!signatureHeader) return { valid: false, error: "Missing signature header" };
  if (!timestampHeader) return { valid: false, error: "Missing timestamp header" };

  const requestTime = Date.parse(timestampHeader);
  if (isNaN(requestTime)) return { valid: false, error: "Invalid timestamp format" };
  if (Math.abs(Date.now() - requestTime) > MAX_TIMESTAMP_DRIFT_MS) {
    return { valid: false, error: "Timestamp drift too large" };
  }

  const expected = computeSignature(secret, method, path, timestampHeader, computeBodyHash(body));
  const sig = Buffer.from(signatureHeader, "utf8");
  const exp = Buffer.from(expected, "utf8");
  if (sig.length !== exp.length || !timingSafeEqual(sig, exp)) {
    return { valid: false, error: "Invalid signature" };
  }
  return { valid: true };
}

function rawBodyOf(request: FastifyRequest): Buffer {
  return (request as unknown as { rawBody?: Buffer }).rawBody ?? Buffer.alloc(0);
}

/**
 * A Fastify preHandler that rejects any GZAC→app request whose HMAC does not verify. Routes that
 * opt in to raw-body capture (`config: { rawBody: true }`) bind their JSON body; GET/DELETE routes
 * bind an empty body, exactly like the plugin host.
 */
export function createHmacAuthHook(secret: string): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = verifyHmac(
      secret,
      request.method,
      request.url.split("?")[0],
      request.headers[SIGNATURE_HEADER] as string | undefined,
      request.headers[TIMESTAMP_HEADER] as string | undefined,
      rawBodyOf(request),
    );
    if (!result.valid) {
      request.log.warn({ error: result.error, path: request.url }, "HMAC verification failed");
      reply.code(401).send({ error: "Unauthorized: " + result.error });
    }
  };
}
