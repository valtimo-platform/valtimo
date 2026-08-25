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
import rawBody from "fastify-raw-body";
import multipart from "@fastify/multipart";

/**
 * Registers the body handling every route depends on: raw-body capture for HMAC verification and
 * multipart for plugin uploads. Shared by production (`index.ts`) and the test harness so an L2
 * route test exercises the same parsers a real request meets.
 *
 * `text/plain` is deliberately unregistered. `fastify-raw-body` reads `request.raw` itself while
 * Fastify parses the same stream; Fastify's default `text/plain` parser is a *string* parser, so it
 * calls `payload.setEncoding('utf8')` and `raw-body` then collects strings and throws from
 * `Buffer.concat` inside a stream `end` callback — outside Fastify's promise chain, i.e. an uncaught
 * exception that kills the process. No host route accepts `text/plain`, so removing the parser turns
 * that into the 415 every other unhandled type already gets. `application/json` is safe because
 * fastify-raw-body replaces it with a buffer parser; `multipart/form-data` is safe because busboy
 * does not set an encoding.
 */
export async function registerBodyParsing(
  app: FastifyInstance,
  opts: {uploadMaxBytes: number}
): Promise<void> {
  await app.register(rawBody, {
    field: "rawBody",
    global: false, // Only enable on routes that request it via config.rawBody
    encoding: false, // Return Buffer, not string
    runFirst: true, // Run before JSON parsing
  });

  // The cap applies BEFORE the upload route buffers the file for its HMAC check, so an
  // unauthenticated caller can't make the host buffer huge payloads.
  await app.register(multipart, {
    limits: {
      fileSize: opts.uploadMaxBytes,
    },
  });

  app.removeContentTypeParser("text/plain");
}
