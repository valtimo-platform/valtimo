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
 * ⚠️ SECURITY: this route is **public** (no HMAC, no auth) for this iteration — it executes plugin
 * Wasm unauthenticated, exactly like the public bundle routes. It must be capability-gated (and/or
 * authenticated) before production. Plugins must therefore treat `handle_request` input as
 * untrusted and never return data they would not expose publicly.
 */
export async function pluginDataRoutes(
  fastify: FastifyInstance,
  opts: { pluginManager: PluginManager; configRegistry: ConfigRegistry; config: AppConfig }
): Promise<void> {
  const { pluginManager, configRegistry } = opts;

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
    };
  }>(
    "/plugins/:pluginId/:version/data",
    async (request, reply) => {
      const { pluginId, version } = request.params;
      const { configurationId, method, path, query, body, context } = request.body ?? ({} as never);

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

      let configuration: Record<string, unknown> = {};
      let serviceToken: string | undefined;
      let gzacBaseUrl: string | undefined;
      if (configurationId) {
        const pluginConfig = await configRegistry.get(configurationId);
        if (pluginConfig) {
          configuration = pluginConfig.properties;
          serviceToken = pluginConfig.serviceToken;
          gzacBaseUrl = pluginConfig.gzacBaseUrl;
        }
      }

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
