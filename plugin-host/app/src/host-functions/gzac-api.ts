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

import type {CallContext} from "@extism/extism";
import type {HostLogger} from "../models/index.js";

/**
 * Per-call context the host attaches to every `plugin.call(...)`. Made available to host
 * functions via `callContext.hostContext<T>()`.
 */
export interface GzacApiCallContext {
  configurationId: string;
  pluginId: string;
  pluginVersion: string;
  serviceToken: string;
  gzacBaseUrl: string;
}

interface GzacApiRequest {
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

interface GzacApiResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * Builds the Extism host function entry registered as `extism:host/user::gzac_api`. Plugins call
 * this to make an authenticated callback into the GZAC instance that owns their configuration.
 *
 * The plugin sends a JSON request `{ method, path, body?, headers? }`; the host returns a JSON
 * response `{ status, headers, body }`. `body` is parsed as JSON when GZAC responds with parseable
 * JSON, otherwise returned as raw text.
 *
 * Note: this function is async — it requires Extism plugins to run with `runInWorker: true` (see
 * `plugin-manager.ts`) so that async host functions work on Node versions without JSPI.
 */
export function createGzacApiHostFunction(
  logger: HostLogger
): (callContext: CallContext, addr: bigint) => Promise<bigint> {
  const log = logger.child({ component: "gzac_api" });

  return async (callContext: CallContext, addr: bigint): Promise<bigint> => {
    const ctx = callContext.hostContext<GzacApiCallContext | undefined>();
    if (!ctx) {
      return callContext.store(
        JSON.stringify(errorReply(500, "No active invocation context"))
      );
    }

    const inputJson = callContext.read(addr)?.string() ?? "{}";
    let req: GzacApiRequest;
    try {
      req = JSON.parse(inputJson) as GzacApiRequest;
    } catch (err) {
      return callContext.store(
        JSON.stringify(
          errorReply(400, `Invalid gzac_api request JSON: ${(err as Error).message}`)
        )
      );
    }

    if (!req.method || typeof req.method !== "string") {
      return callContext.store(
        JSON.stringify(errorReply(400, "Missing 'method' in gzac_api request"))
      );
    }
    if (!req.path || typeof req.path !== "string" || !req.path.startsWith("/")) {
      return callContext.store(
        JSON.stringify(
          errorReply(400, "'path' must be set and start with '/' in gzac_api request")
        )
      );
    }

    const url = `${ctx.gzacBaseUrl.replace(/\/$/, "")}${req.path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${ctx.serviceToken}`,
      Accept: "application/json",
      ...(req.headers ?? {}),
    };
    let bodyInit: BodyInit | undefined;
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === "string") {
        bodyInit = req.body;
      } else {
        if (!Object.keys(headers).some((h) => h.toLowerCase() === "content-type")) {
          headers["Content-Type"] = "application/json";
        }
        bodyInit = JSON.stringify(req.body);
      }
    }

    const start = Date.now();
    log.info(
      {
        configurationId: ctx.configurationId,
        pluginId: ctx.pluginId,
        pluginVersion: ctx.pluginVersion,
        method: req.method,
        path: req.path,
      },
      "gzac_api call"
    );

    try {
      const res = await fetch(url, {
        method: req.method.toUpperCase(),
        headers,
        body: bodyInit,
      });
      const text = await res.text();
      let body: unknown = text;
      if (text.length > 0) {
        try {
          body = JSON.parse(text);
        } catch {
          // keep raw text
        }
      }
      const out: GzacApiResponse = {
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        body,
      };
      log.info(
        { method: req.method, url, status: res.status, durationMs: Date.now() - start },
        "gzac_api response"
      );
      return callContext.store(JSON.stringify(out));
    } catch (err) {
      log.warn(
        { method: req.method, url, error: (err as Error).message, durationMs: Date.now() - start },
        "gzac_api error"
      );
      return callContext.store(
        JSON.stringify(errorReply(502, `gzac_api fetch failed: ${(err as Error).message}`))
      );
    }
  };
}

function errorReply(status: number, message: string): GzacApiResponse {
  return {
    status,
    headers: { "content-type": "application/json" },
    body: { error: message },
  };
}
