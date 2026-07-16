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

import type { CallContext } from "@extism/extism";
import type { HostLogger } from "../models/index.js";
import type { LogRepository } from "../db/log-repository.js";
import type { GzacApiCallContext } from "./gzac-api.js";

interface HttpRequestInput {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

interface HttpRequestOutput {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

const MAX_TIMEOUT_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 30_000;

export function createHttpRequestHostFunction(
  logger: HostLogger,
  logRepository: LogRepository,
  allowHttp: boolean
): (callContext: CallContext, addr: bigint) => Promise<bigint> {
  const log = logger.child({ component: "http_request" });

  return async (callContext: CallContext, addr: bigint): Promise<bigint> => {
    const ctx = callContext.hostContext<GzacApiCallContext | undefined>();
    if (!ctx) {
      return callContext.store(JSON.stringify(errorReply(500, "No active invocation context")));
    }

    if (!ctx.grantedCapabilities?.includes("http_request")) {
      return callContext.store(
        JSON.stringify(errorReply(403, "Capability 'http_request' not granted for this configuration"))
      );
    }

    const inputJson = callContext.read(addr)?.string() ?? "{}";
    let req: HttpRequestInput;
    try {
      req = JSON.parse(inputJson) as HttpRequestInput;
    } catch (err) {
      return callContext.store(
        JSON.stringify(errorReply(400, `Invalid http_request JSON: ${(err as Error).message}`))
      );
    }

    if (!req.method || typeof req.method !== "string") {
      return callContext.store(JSON.stringify(errorReply(400, "Missing 'method'")));
    }
    if (!req.url || typeof req.url !== "string") {
      return callContext.store(JSON.stringify(errorReply(400, "Missing 'url'")));
    }

    let parsed: URL;
    try {
      parsed = new URL(req.url);
    } catch {
      return callContext.store(JSON.stringify(errorReply(400, "Invalid URL")));
    }

    if (!allowHttp && parsed.protocol !== "https:") {
      return callContext.store(
        JSON.stringify(errorReply(400, "Only HTTPS URLs are allowed (set HOST_ALLOW_HTTP=true for dev)"))
      );
    }

    // Block calls to the GZAC instance — use gzac_api for that.
    if (ctx.gzacBaseUrl) {
      try {
        const gzacOrigin = new URL(ctx.gzacBaseUrl).origin;
        if (parsed.origin === gzacOrigin) {
          return callContext.store(
            JSON.stringify(errorReply(400, "Use gzac_api to call the GZAC instance, not http_request"))
          );
        }
      } catch {
        // gzacBaseUrl unparseable — skip the check
      }
    }

    const timeoutMs = Math.min(req.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);

    const headers: Record<string, string> = {
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
      { configurationId: ctx.configurationId, method: req.method, url: req.url },
      "http_request call"
    );

    try {
      const res = await fetch(req.url, {
        method: req.method.toUpperCase(),
        headers,
        body: bodyInit,
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "follow",
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

      const durationMs = Date.now() - start;
      const out: HttpRequestOutput = {
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        body,
      };

      log.info({ method: req.method, url: req.url, status: res.status, durationMs }, "http_request response");

      logRepository
        .insert({
          configurationId: ctx.configurationId,
          pluginId: ctx.pluginId,
          pluginVersion: ctx.pluginVersion,
          level: "info",
          message: `${req.method.toUpperCase()} ${req.url} → ${res.status}`,
          data: { method: req.method, url: req.url, status: res.status, durationMs },
          source: "http_request",
        })
        .catch(() => {});

      return callContext.store(JSON.stringify(out));
    } catch (err) {
      const durationMs = Date.now() - start;
      const errMsg = (err as Error).message;
      log.warn({ method: req.method, url: req.url, error: errMsg, durationMs }, "http_request error");

      logRepository
        .insert({
          configurationId: ctx.configurationId,
          pluginId: ctx.pluginId,
          pluginVersion: ctx.pluginVersion,
          level: "error",
          message: `${req.method.toUpperCase()} ${req.url} → error: ${errMsg}`,
          data: { method: req.method, url: req.url, error: errMsg, durationMs },
          source: "http_request",
        })
        .catch(() => {});

      return callContext.store(
        JSON.stringify(errorReply(502, `http_request failed: ${errMsg}`))
      );
    }
  };
}

function errorReply(status: number, message: string): HttpRequestOutput {
  return {
    status,
    headers: { "content-type": "application/json" },
    body: { error: message },
  };
}
