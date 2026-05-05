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
import { PluginManager } from "../plugin-manager.js";
import { ConfigRegistry } from "../config-registry.js";

/**
 * Plugin action execution endpoint.
 *
 * GZAC calls this when a process link fires on a service task.
 * The host looks up the configuration, injects decrypted properties
 * into the Wasm function input, and returns variables to the process.
 *
 * POC: no token auth on this route. Production: service token + HMAC.
 */
export async function pluginActionRoutes(
  fastify: FastifyInstance,
  opts: { pluginManager: PluginManager; configRegistry: ConfigRegistry }
): Promise<void> {
  const { pluginManager, configRegistry } = opts;

  /**
   * POST /plugins/:pluginId/:version/actions/:actionKey
   *
   * Body: {
   *   configurationId: string,
   *   processInstanceId: string,
   *   documentId: string,
   *   activityId: string,
   *   properties: Record<string, unknown>
   * }
   *
   * The host resolves the configuration from its registry and injects
   * the decrypted properties into the Wasm call input.
   */
  fastify.post<{
    Params: {
      pluginId: string;
      version: string;
      actionKey: string;
    };
    Body: {
      configurationId: string;
      processInstanceId: string;
      documentId: string;
      activityId: string;
      properties: Record<string, unknown>;
    };
  }>(
    "/plugins/:pluginId/:version/actions/:actionKey",
    async (request, reply) => {
      const { pluginId, version, actionKey } = request.params;
      const {
        configurationId,
        processInstanceId,
        documentId,
        activityId,
        properties,
      } = request.body;

      // Verify the plugin is loaded
      const manifest = pluginManager.getManifest(pluginId, version);
      if (!manifest) {
        reply.code(404).send({
          error: `Plugin not found: ${pluginId}@${version}`,
        });
        return;
      }

      // Verify the action exists
      const actionDef = manifest.actions.find((a) => a.key === actionKey);
      if (!actionDef) {
        reply.code(404).send({
          error: `Action '${actionKey}' not found on plugin ${pluginId}@${version}`,
        });
        return;
      }

      // Look up configuration (injected by GZAC via push)
      let configuration: Record<string, unknown> = {};
      if (configurationId) {
        const pluginConfig = configRegistry.get(configurationId);
        if (pluginConfig) {
          // Verify configuration targets the right plugin version
          if (
            pluginConfig.pluginId !== pluginId ||
            pluginConfig.pluginVersion !== version
          ) {
            reply.code(400).send({
              error: `Configuration ${configurationId} targets ${pluginConfig.pluginId}@${pluginConfig.pluginVersion}, not ${pluginId}@${version}`,
            });
            return;
          }
          configuration = pluginConfig.properties;
        }
      }

      try {
        const result = await pluginManager.callAction(
          pluginId,
          version,
          actionKey,
          {
            configurationId: configurationId || "",
            configuration,
            processInstanceId: processInstanceId || "",
            documentId: documentId || "",
            activityId: activityId || "",
            properties: properties || {},
          }
        );

        if (result.status === "error") {
          // 4xx for plugin-level errors (catchable by BPMN error events)
          reply.code(422).send(result);
          return;
        }

        reply.code(200).send(result);
      } catch (err) {
        request.log.error(
          {
            pluginId,
            version,
            actionKey,
            error: (err as Error).message,
          },
          "Action execution failed"
        );
        // 5xx for host/infrastructure errors (creates Operaton incident)
        reply.code(500).send({
          status: "error",
          errorCode: "HOST_ERROR",
          errorMessage: (err as Error).message,
        });
      }
    }
  );

  /**
   * GET /plugins/:pluginId/:version/plugin-manifest
   */
  fastify.get<{ Params: { pluginId: string; version: string } }>(
    "/plugins/:pluginId/:version/plugin-manifest",
    async (request, reply) => {
      const { pluginId, version } = request.params;
      const manifest = pluginManager.getManifest(pluginId, version);

      if (!manifest) {
        reply
          .code(404)
          .send({ error: `Plugin not found: ${pluginId}@${version}` });
        return;
      }

      return manifest;
    }
  );
}
