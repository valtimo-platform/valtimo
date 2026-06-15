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

import type {
  FastifyReply,
  FastifyRequest,
  preHandlerHookHandler,
} from "fastify";
import {
  verifyHmac,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  type HmacVerificationResult,
} from "./hmac.js";

declare module "fastify" {
  interface FastifyContextConfig {
    // Opt a route out of the shared raw-body HMAC hook because it binds a different body
    // representation. The multipart upload route signs the uploaded file bytes (not the multipart
    // envelope, whose boundary the signer cannot reproduce), so it verifies inside its own handler.
    deferHmac?: boolean;
  }
}

function rawBodyOf(request: FastifyRequest): Buffer {
  return (request as unknown as { rawBody?: Buffer }).rawBody ?? Buffer.alloc(0);
}

function rejectUnauthorized(
  request: FastifyRequest,
  reply: FastifyReply,
  error: string | undefined
): void {
  request.log.warn({ error, path: request.url }, "HMAC verification failed");
  reply.code(401).send({ error: "Unauthorized: " + error });
}

/**
 * Verifies the HMAC signature of an incoming request against an explicit body buffer. The canonical
 * string is `{METHOD}\n{path}\n{timestamp}\n{bodyHash}` (see hmac.ts), matching the backend's
 * ExternalPluginHmacSigner. The path is `request.url` minus the query string.
 */
export function verifyHmacRequest(
  request: FastifyRequest,
  secret: string,
  body: Buffer
): HmacVerificationResult {
  return verifyHmac(
    secret,
    request.method,
    request.url.split("?")[0],
    request.headers[SIGNATURE_HEADER] as string | undefined,
    request.headers[TIMESTAMP_HEADER] as string | undefined,
    body
  );
}

/**
 * preHandler that authenticates GZAC→host requests by HMAC signature over the captured raw body.
 * The HMAC key is the host's `ADMIN_TOKEN` — the shared secret carried as a replay-windowed,
 * body-bound signature rather than a static bearer. Routes that opt in to raw-body capture
 * (`config.rawBody`) bind their JSON body; routes that do not bind an empty body (GET/DELETE).
 * Routes flagged `config.deferHmac` are skipped here and verify themselves once their body is read.
 */
export function createHmacAuthHook(secret: string): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.routeOptions.config?.deferHmac) {
      return;
    }
    const result = verifyHmacRequest(request, secret, rawBodyOf(request));
    if (!result.valid) {
      rejectUnauthorized(request, reply, result.error);
    }
  };
}

/**
 * Verifies an HMAC-signed request whose signed body is an explicit buffer rather than the raw HTTP
 * body, replying 401 when invalid. Used by the multipart plugin-upload route, which signs the
 * uploaded file bytes. Returns true when the request is authentic.
 */
export function verifyDeferredHmac(
  request: FastifyRequest,
  reply: FastifyReply,
  secret: string,
  body: Buffer
): boolean {
  const result = verifyHmacRequest(request, secret, body);
  if (!result.valid) {
    rejectUnauthorized(request, reply, result.error);
    return false;
  }
  return true;
}
