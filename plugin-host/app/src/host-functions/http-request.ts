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

import { Agent, fetch } from "undici";
import type { Response } from "undici";
import type { CallContext } from "@extism/extism";
import type { HostLogger } from "../models/index.js";
import type { LogRepository } from "../db/log-repository.js";
import { guardHostCall } from "./guard.js";
import {
  createGuardedAgent,
  findBlockedIpLiteral,
  isPrivateAddressError,
  rootCauseMessage,
} from "../security/url-guard.js";

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

/**
 * Strips credentials from a URL before it is logged or persisted: userinfo and the query string
 * (and fragment) routinely carry secrets (`user:pass@`, `?token=…`), so only scheme+host+path are
 * recorded.
 */
export function redactUrl(raw: string): string {
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return raw.split(/[?#]/)[0];
  }
}

const MAX_TIMEOUT_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export function createHttpRequestHostFunction(
  logger: HostLogger,
  logRepository: LogRepository,
  allowHttp: boolean,
  allowPrivateNetwork: boolean
): (callContext: CallContext, addr: bigint) => Promise<bigint> {
  const log = logger.child({ component: "http_request" });

  // The guarded agent blocks connections to private/reserved addresses at the socket's own DNS
  // lookup, so hostname checks are pinned to the exact addresses being connected to (no DNS
  // rebinding window) and automatically cover every redirect hop.
  const dispatcher = allowPrivateNetwork ? new Agent() : createGuardedAgent();

  /**
   * Validates a request target. Applied to the initial URL AND to every redirect hop, so a public
   * URL cannot 3xx the host into the GZAC instance or an internal service.
   */
  const validateTarget = (url: URL, gzacBaseUrl: string | undefined): string | null => {
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "Only http(s) URLs are supported";
    }
    if (!allowHttp && url.protocol !== "https:") {
      return "Only HTTPS URLs are allowed (set HOST_ALLOW_HTTP=true for dev)";
    }

    // Block calls to the GZAC instance — use gzac_api for that.
    if (gzacBaseUrl) {
      try {
        if (url.origin === new URL(gzacBaseUrl).origin) {
          return "Use gzac_api to call the GZAC instance, not http_request";
        }
      } catch {
        // gzacBaseUrl unparseable — skip the check
      }
    }

    // IP-literal hosts skip DNS, so the guarded agent's lookup never sees them — reject here.
    if (!allowPrivateNetwork) {
      const violation = findBlockedIpLiteral(url);
      if (violation) {
        return `${violation} (set HOST_ALLOW_PRIVATE_NETWORK=true for dev)`;
      }
    }

    return null;
  };

  return async (callContext: CallContext, addr: bigint): Promise<bigint> => {
    const guard = guardHostCall<HttpRequestInput>(callContext, addr, "http_request");
    if (!guard.ok) {
      return callContext.store(JSON.stringify(errorReply(guard.status, guard.message)));
    }
    const { ctx, req } = guard;

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

    const targetError = validateTarget(parsed, ctx.gzacBaseUrl);
    if (targetError) {
      return callContext.store(JSON.stringify(errorReply(400, targetError)));
    }

    const timeoutMs = Math.min(req.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(req.headers ?? {}),
    };
    let bodyInit: string | undefined;
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
    // Logged/persisted URLs are redacted (no userinfo, no query string) — see redactUrl.
    const safeUrl = redactUrl(req.url);
    log.info(
      { configurationId: ctx.configurationId, method: req.method, url: safeUrl },
      "http_request call"
    );

    try {
      let currentUrl = parsed;
      let method = req.method.toUpperCase();
      let currentHeaders = headers;
      let currentBody = bodyInit;
      let redirects = 0;
      let res: Response;

      // Redirects are followed manually so every hop goes through validateTarget — with
      // redirect: "follow" a public URL could bounce the request to an internal one unchecked.
      for (;;) {
        res = await fetch(currentUrl, {
          method,
          headers: currentHeaders,
          body: currentBody,
          signal: AbortSignal.timeout(timeoutMs),
          redirect: "manual",
          dispatcher,
        });

        const location = res.headers.get("location");
        if (!REDIRECT_STATUSES.has(res.status) || !location) break;
        await res.body?.cancel();

        if (redirects >= MAX_REDIRECTS) {
          return callContext.store(
            JSON.stringify(errorReply(502, `Too many redirects (max ${MAX_REDIRECTS})`))
          );
        }
        redirects++;

        let next: URL;
        try {
          next = new URL(location, currentUrl);
        } catch {
          return callContext.store(
            JSON.stringify(errorReply(502, `Invalid redirect location: ${location}`))
          );
        }

        const redirectError = validateTarget(next, ctx.gzacBaseUrl);
        if (redirectError) {
          return callContext.store(
            JSON.stringify(errorReply(400, `Redirect to '${next}' blocked: ${redirectError}`))
          );
        }

        // Per fetch semantics: 303 — and 301/302 for body-bearing methods — becomes a GET without body.
        if (res.status === 303 || ((res.status === 301 || res.status === 302) && method !== "GET" && method !== "HEAD")) {
          method = "GET";
          currentBody = undefined;
        }
        // Never forward credentials to a different origin.
        if (next.origin !== currentUrl.origin) {
          currentHeaders = Object.fromEntries(
            Object.entries(currentHeaders).filter(
              ([name]) => !["authorization", "cookie", "proxy-authorization"].includes(name.toLowerCase())
            )
          );
        }
        currentUrl = next;
      }

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

      log.info({ method: req.method, url: safeUrl, status: res.status, durationMs }, "http_request response");

      logRepository
        .insert({
          configurationId: ctx.configurationId,
          pluginId: ctx.pluginId,
          pluginVersion: ctx.pluginVersion,
          level: "info",
          message: `${req.method.toUpperCase()} ${safeUrl} → ${res.status}`,
          data: { method: req.method, url: safeUrl, status: res.status, durationMs },
          source: "http_request",
        })
        .catch((e) => log.warn({ error: (e as Error).message }, "Failed to persist http_request log"));

      return callContext.store(JSON.stringify(out));
    } catch (err) {
      const durationMs = Date.now() - start;
      // undici wraps connection failures in a generic "fetch failed" — report the real reason.
      const errMsg = rootCauseMessage(err);
      log.warn({ method: req.method, url: safeUrl, error: errMsg, durationMs }, "http_request error");

      logRepository
        .insert({
          configurationId: ctx.configurationId,
          pluginId: ctx.pluginId,
          pluginVersion: ctx.pluginVersion,
          level: "error",
          message: `${req.method.toUpperCase()} ${safeUrl} → error: ${errMsg}`,
          data: { method: req.method, url: safeUrl, error: errMsg, durationMs },
          source: "http_request",
        })
        .catch((e) => log.warn({ error: (e as Error).message }, "Failed to persist http_request log"));

      // The guarded agent refusing a private/reserved target is a policy rejection, not an
      // upstream failure — report it like the other validation errors.
      if (isPrivateAddressError(err)) {
        return callContext.store(
          JSON.stringify(errorReply(400, `${errMsg} (set HOST_ALLOW_PRIVATE_NETWORK=true for dev)`))
        );
      }

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
