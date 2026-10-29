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
import type {Endpoint, HostLogger} from "../models/index.js";
import {isEndpointAllowed} from "../security/endpoint-allowlist.js";
import {normalizeGzacApiPath} from "../security/request-path.js";
import {guardHostCall} from "./guard.js";

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
  /**
   * Downscoped user token forwarded from a tab's `handle_request` invocation. Present only when the
   * tab forwarded it; absent for action/event invocations. Used when a request asks for `as:"user"`.
   */
  userToken?: string;
  /**
   * Host capabilities the admin granted at activation. Each host function checks this list before
   * executing. A configuration must explicitly include the required capability.
   */
  grantedCapabilities?: string[];
  /**
   * GZAC endpoints the admin granted at activation (Ant-style patterns; see
   * `security/endpoint-allowlist.ts`). Requests outside this list are refused before the fetch.
   * `undefined` means the owning GZAC instance didn't push an endpoint list (older push) — the
   * host then warns and allows, relying on GZAC's server-side allowlist filter alone.
   */
  grantedEndpoints?: Endpoint[];
  /**
   * Origins `http_request` may call, as accepted by the admin at activation (see
   * `security/egress-allowlist.ts`). GZAC unions the plugin manifest's `permissions.egress` with the
   * configuration properties marked `x-egress-target`, so the host never has to know which source an
   * entry came from. Deny-by-default: empty or absent means the configuration makes no outbound HTTP
   * calls at all.
   */
  allowedEgress?: string[];
}

interface GzacApiRequest {
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** `"user"` → authenticate with the downscoped user token; otherwise the service token. */
  as?: "user" | "service";
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
  logger: HostLogger,
  options: { timeoutMs?: number } = {}
): (callContext: CallContext, addr: bigint) => Promise<bigint> {
  const log = logger.child({ component: "gzac_api" });
  const timeoutMs = options.timeoutMs ?? 60_000;

  return async (callContext: CallContext, addr: bigint): Promise<bigint> => {
    const guard = guardHostCall<GzacApiRequest>(callContext, addr, "gzac_api");
    if (!guard.ok) {
      return callContext.store(JSON.stringify(errorReply(guard.status, guard.message)));
    }
    const { ctx, req } = guard;

    if (!req.method || typeof req.method !== "string") {
      return callContext.store(
        JSON.stringify(errorReply(400, "Missing 'method' in gzac_api request"))
      );
    }
    // Canonicalise once, then use only this value: `fetch` resolves dot segments while parsing the
    // URL, so checking the raw path would let a grant on one prefix authorise a request to a
    // completely different endpoint. Everything downstream — the allowlist check, the outgoing URL,
    // the refusal messages, and the audit log — refers to the same string that is requested.
    const normalized = normalizeGzacApiPath(req.path);
    if (!normalized.ok) {
      return callContext.store(JSON.stringify(errorReply(400, normalized.reason)));
    }
    const path = normalized.path;

    // Enforce the granted-endpoint allowlist before anything leaves the host. GZAC's servlet
    // filter is the authoritative gate; this check refuses non-granted callbacks early. A config
    // without an endpoint list (older GZAC push) is allowed with a warning — see
    // GzacApiCallContext.grantedEndpoints.
    if (ctx.grantedEndpoints === undefined) {
      log.warn(
        { configurationId: ctx.configurationId, method: req.method, path },
        "Configuration carries no granted-endpoint list (older GZAC push) — allowing gzac_api call without host-side allowlist check"
      );
    } else if (!isEndpointAllowed(req.method, path, ctx.grantedEndpoints)) {
      log.warn(
        { configurationId: ctx.configurationId, method: req.method, path },
        "gzac_api call refused: endpoint not in the configuration's granted allowlist"
      );
      return callContext.store(
        JSON.stringify(
          errorReply(
            403,
            `Endpoint not granted for this configuration: ${req.method.toUpperCase()} ${path}`
          )
        )
      );
    }

    // Select the credential: the downscoped user token (PBAC ∩ allowlist) when the plugin asked for
    // `as:"user"`, otherwise the service token (system credential, allowlist-only).
    let token = ctx.serviceToken;
    if (req.as === "user") {
      if (!ctx.userToken) {
        return callContext.store(
          JSON.stringify(
            errorReply(401, "No user token available for this invocation (as:\"user\" requires a tab request that forwarded the user token)")
          )
        );
      }
      token = ctx.userToken;
    }

    const url = `${ctx.gzacBaseUrl.replace(/\/$/, "")}${path}`;
    // Plugin-supplied headers first, host-controlled credentials LAST — so a plugin can never
    // override the Authorization header the host attaches. Any Authorization the plugin sends is
    // stripped explicitly (and logged) rather than silently shadowed.
    const pluginHeaders: Record<string, string> = { ...(req.headers ?? {}) };
    for (const name of Object.keys(pluginHeaders)) {
      if (name.toLowerCase() === "authorization") {
        log.warn(
          { configurationId: ctx.configurationId, pluginId: ctx.pluginId, path },
          "Stripping plugin-supplied Authorization header from gzac_api request"
        );
        delete pluginHeaders[name];
      }
    }
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...pluginHeaders,
      Authorization: `Bearer ${token}`,
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
        path,
      },
      "gzac_api call"
    );

    try {
      const res = await fetch(url, {
        method: req.method.toUpperCase(),
        headers,
        body: bodyInit,
        // Bound the callback so a hung GZAC endpoint can't pin the plugin call (and the pooled
        // Wasm instance it holds) indefinitely.
        signal: AbortSignal.timeout(timeoutMs),
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
      // AbortSignal.timeout rejects with a TimeoutError DOMException — report it distinctly so
      // plugins can tell a slow GZAC from an unreachable one.
      if ((err as Error).name === "TimeoutError" || (err as Error).name === "AbortError") {
        return callContext.store(
          JSON.stringify(
            errorReply(504, `gzac_api request timed out after ${timeoutMs}ms: ${req.method.toUpperCase()} ${path}`)
          )
        );
      }
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
