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
import {
  verifyHmac,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
} from "../security/hmac.js";

/**
 * Plugin action execution endpoint.
 *
 * GZAC calls this when a process link fires on a service task.
 * The host looks up the configuration from its in-memory registry
 * (pushed by GZAC on activation/startup), injects decrypted properties
 * into the Wasm function input, and returns variables to the process.
 *
 * Authentication: HMAC-SHA256 signature over `{method}\n{path}\n{timestamp}\n{bodyHash}`
 * using the shared secret (ADMIN_TOKEN). This ensures requests originate from a GZAC
 * instance that knows the host's secret.
 */
export async function pluginActionRoutes(
  fastify: FastifyInstance,
  opts: { pluginManager: PluginManager; configRegistry: ConfigRegistry; config: AppConfig }
): Promise<void> {
  const { pluginManager, configRegistry, config } = opts;

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
   * GZAC pushes configurations to the host on activation/startup via the
   * configuration push API. At action time, only the configurationId is
   * sent. The host looks up decrypted properties from its in-memory registry.
   *
   * Authentication: HMAC-SHA256 signature in X-Valtimo-Signature header.
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
    {
      // Capture raw body for HMAC verification while still parsing JSON
      config: {
        rawBody: true,
      },
      preHandler: async (request, reply) => {
        const rawBody = (request as unknown as { rawBody?: Buffer }).rawBody ?? Buffer.alloc(0);
        const signatureHeader = request.headers[SIGNATURE_HEADER] as string | undefined;
        const timestampHeader = request.headers[TIMESTAMP_HEADER] as string | undefined;

        const result = verifyHmac(
          config.ADMIN_TOKEN,
          request.method,
          request.url.split("?")[0], // path without query string
          signatureHeader,
          timestampHeader,
          rawBody
        );

        if (!result.valid) {
          request.log.warn({ error: result.error, path: request.url }, "HMAC verification failed");
          reply.code(401).send({ error: "Unauthorized: " + result.error });
          return;
        }
      },
    },
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

      // Look up configuration from registry (pushed by GZAC on activation/startup)
      if (!configurationId) {
        reply.code(400).send({
          error: "Missing required field: configurationId",
        });
        return;
      }

      const pluginConfig = await configRegistry.get(configurationId);
      if (!pluginConfig) {
        reply.code(404).send({
          error: `Configuration not found: ${configurationId}. GZAC may need to re-sync configurations.`,
        });
        return;
      }

      if (
        pluginConfig.pluginId !== pluginId ||
        pluginConfig.pluginVersion !== version
      ) {
        reply.code(400).send({
          error: `Configuration ${configurationId} targets ${pluginConfig.pluginId}@${pluginConfig.pluginVersion}, not ${pluginId}@${version}`,
        });
        return;
      }

      if (!pluginConfig.serviceToken || !pluginConfig.gzacBaseUrl) {
        reply.code(500).send({
          status: "error",
          errorCode: "MISSING_CALLBACK_CONTEXT",
          errorMessage: `Configuration ${configurationId} is missing serviceToken or gzacBaseUrl. GZAC must re-push the configuration before this plugin can call back.`,
        });
        return;
      }

      const configuration = pluginConfig.properties;

      try {
        const result = await pluginManager.callAction(
          pluginId,
          version,
          actionKey,
          {
            configurationId,
            configuration,
            processInstanceId: processInstanceId || "",
            documentId: documentId || "",
            activityId: activityId || "",
            properties: properties || {},
            serviceToken: pluginConfig.serviceToken,
            gzacBaseUrl: pluginConfig.gzacBaseUrl,
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
