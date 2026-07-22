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

import {FastifyInstance} from "fastify";
import {PluginManager} from "../plugin-manager.js";
import {ConfigRegistry} from "../config-registry.js";
import type {AppConfig} from "../config.js";

/**
 * Plugin-served data route.
 *
 * `POST /plugins/:pluginId/:version/data` invokes the plugin's `handle_request` Wasm export and
 * returns the JSON it produces. It is the RPC-style counterpart of the action route, used by a
 * plugin's own iframe (through the Angular parent-proxy) to fetch data the plugin serves itself.
 *
 * Served cross-origin to the GZAC frontend (`Access-Control-Allow-Origin: *`), like the bundle
 * routes.
 *
 * Security: the route carries no HMAC (the caller is a browser, not GZAC), but executing plugin
 * Wasm is gated on the target configuration: the request must name a `configurationId` whose
 * pushed configuration exists, targets this plugin version, and was granted the `frontend_data`
 * capability by an admin — otherwise 403 and the Wasm never runs. A per-configuration in-memory
 * rate limit (`DATA_RATE_LIMIT_PER_MINUTE`) bounds abuse of the public endpoint. Plugins must
 * still treat `handle_request` input as untrusted and never return data they would not expose to
 * every user of the configuration's GZAC instance.
 */
export async function pluginDataRoutes(
  fastify: FastifyInstance,
  opts: { pluginManager: PluginManager; configRegistry: ConfigRegistry; config: AppConfig }
): Promise<void> {
  const { pluginManager, configRegistry, config } = opts;

  // Fixed-window request counter per configurationId. In-memory (per replica) — good enough to
  // stop a single host being hammered; 0 disables.
  const rateLimitPerMinute = config.DATA_RATE_LIMIT_PER_MINUTE ?? 0;
  const windows = new Map<string, { windowStart: number; count: number }>();
  const isRateLimited = (configurationId: string): boolean => {
    if (rateLimitPerMinute <= 0) return false;
    const now = Date.now();
    const window = windows.get(configurationId);
    if (!window || now - window.windowStart >= 60_000) {
      windows.set(configurationId, { windowStart: now, count: 1 });
      return false;
    }
    window.count += 1;
    return window.count > rateLimitPerMinute;
  };

  // CORS preflight for the cross-origin POST from the opaque-origin iframe / GZAC frontend.
  fastify.options<{ Params: { pluginId: string; version: string } }>(
    "/plugins/:pluginId/:version/data",
    async (_request, reply) => {
      reply
        .header("Access-Control-Allow-Origin", "*")
        .header("Access-Control-Allow-Methods", "POST, OPTIONS")
        .header("Access-Control-Allow-Headers", "Content-Type")
        .code(204)
        .send();
    }
  );

  fastify.post<{
    Params: { pluginId: string; version: string };
    Body: {
      configurationId?: string;
      method: string;
      path: string;
      query?: Record<string, string>;
      body?: unknown;
      context?: Record<string, unknown>;
      /**
       * Downscoped user token forwarded from the tab. Lets a `handle_request` handler call back into
       * GZAC *as the user* (`gzacApi.asUser`, PBAC ∩ allowlist). Optional — when absent the handler
       * can still use the service token.
       */
      userToken?: string;
    };
  }>(
    "/plugins/:pluginId/:version/data",
    async (request, reply) => {
      const { pluginId, version } = request.params;
      const { configurationId, method, path, query, body, context, userToken } =
        request.body ?? ({} as never);

      reply.header("Access-Control-Allow-Origin", "*");

      const manifest = pluginManager.getManifest(pluginId, version);
      if (!manifest) {
        reply.code(404).send({ error: `Plugin not found: ${pluginId}@${version}` });
        return;
      }

      if (!method || !path) {
        reply.code(400).send({ error: "Missing required fields: method and path" });
        return;
      }

      // Capability gate: this public route only executes Wasm for a configuration an admin
      // explicitly granted the `frontend_data` capability.
      if (!configurationId) {
        reply.code(400).send({ error: "Missing required field: configurationId" });
        return;
      }
      const pluginConfig = await configRegistry.get(configurationId);
      if (
        !pluginConfig ||
        pluginConfig.pluginId !== pluginId ||
        pluginConfig.pluginVersion !== version ||
        !pluginConfig.grantedCapabilities?.includes("frontend_data")
      ) {
        // One message for "unknown config" / "wrong plugin" / "capability not granted" so the
        // public endpoint doesn't leak which configurations exist.
        reply.code(403).send({
          error: `Configuration '${configurationId}' does not exist for ${pluginId}@${version} or was not granted the 'frontend_data' capability`,
        });
        return;
      }

      if (isRateLimited(configurationId)) {
        reply.code(429).send({ error: "Rate limit exceeded for this configuration" });
        return;
      }

      const configuration = pluginConfig.properties;
      const serviceToken = pluginConfig.serviceToken;
      const gzacBaseUrl = pluginConfig.gzacBaseUrl;

      try {
        const result = await pluginManager.callRequest(pluginId, version, {
          configurationId,
          configuration,
          method,
          path,
          query,
          body,
          context,
          serviceToken,
          gzacBaseUrl,
          // The caller-supplied user token is forwarded as-is: the host cannot (and does not)
          // validate it — GZAC verifies it server-side on every gzac_api `as:"user"` callback, so
          // a forged token only yields 401s from GZAC.
          userToken,
        });

        if (result.headers) {
          for (const [name, value] of Object.entries(result.headers)) {
            reply.header(name, value);
          }
        }
        reply.code(result.status ?? 200).send(result.body ?? null);
      } catch (err) {
        request.log.error(
          { pluginId, version, path, error: (err as Error).message },
          "Plugin data request failed"
        );
        reply.code(500).send({ error: (err as Error).message });
      }
    }
  );
}
