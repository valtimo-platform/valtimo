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
import {createHmacAuthHook} from "../security/hmac-auth.js";
import {checkContentPin} from "../security/content-pin.js";

/**
 * Plugin task-form submit endpoint (Level 1).
 *
 * GZAC calls this during a task-form submission when the bundle declares `submitHandler: true`.
 * The host looks up the configuration from its in-memory registry (pushed by GZAC), injects
 * decrypted properties + the service token into the Wasm function input, and returns the hook's
 * result to GZAC. GZAC — not the plugin — then completes the task.
 *
 * Authentication: identical to the action route — HMAC-SHA256 over
 * `{method}\n{path}\n{timestamp}\n{bodyHash}` using the shared secret (ADMIN_TOKEN).
 */
export async function pluginSubmitRoutes(
  fastify: FastifyInstance,
  opts: { pluginManager: PluginManager; configRegistry: ConfigRegistry; config: AppConfig }
): Promise<void> {
  const { pluginManager, configRegistry, config } = opts;

  /**
   * POST /plugins/:pluginId/:version/submit/:submitKey
   *
   * Body: {
   *   configurationId: string,
   *   taskId?: string,
   *   processInstanceId?: string,
   *   documentId?: string,
   *   submission: Record<string, unknown>
   * }
   */
  fastify.post<{
    Params: { pluginId: string; version: string; submitKey: string };
    Body: {
      configurationId: string;
      taskId?: string;
      processInstanceId?: string;
      documentId?: string;
      submission: Record<string, unknown>;
    };
  }>(
    "/plugins/:pluginId/:version/submit/:submitKey",
    {
      config: { rawBody: true },
      preHandler: createHmacAuthHook(config.ADMIN_TOKEN),
    },
    async (request, reply) => {
      const { pluginId, version, submitKey } = request.params;
      const { configurationId, taskId, processInstanceId, documentId, submission } = request.body;

      const manifest = pluginManager.getManifest(pluginId, version);
      if (!manifest) {
        reply.code(404).send({ error: `Plugin not found: ${pluginId}@${version}` });
        return;
      }

      if (!configurationId) {
        reply.code(400).send({ error: "Missing required field: configurationId" });
        return;
      }

      const pluginConfig = await configRegistry.get(configurationId);
      if (!pluginConfig) {
        reply.code(404).send({
          error: `Configuration not found: ${configurationId}. GZAC may need to re-sync configurations.`,
        });
        return;
      }

      if (pluginConfig.pluginId !== pluginId || pluginConfig.pluginVersion !== version) {
        reply.code(400).send({
          error: `Configuration ${configurationId} targets ${pluginConfig.pluginId}@${pluginConfig.pluginVersion}, not ${pluginId}@${version}`,
        });
        return;
      }

      const contentRefusal = checkContentPin(pluginConfig, pluginManager, request.log);
      if (contentRefusal) {
        reply.code(409).send(contentRefusal);
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

      try {
        const result = await pluginManager.callSubmit(pluginId, version, submitKey, {
          configurationId,
          configuration: pluginConfig.properties,
          taskId,
          processInstanceId,
          documentId,
          submission: submission || {},
          serviceToken: pluginConfig.serviceToken,
          gzacBaseUrl: pluginConfig.gzacBaseUrl,
        });

        if (result.status === "error") {
          // 422 for plugin-level rejections (validation) — GZAC surfaces errors on the form.
          reply.code(422).send(result);
          return;
        }

        reply.code(200).send(result);
      } catch (err) {
        request.log.error(
          { pluginId, version, submitKey, error: (err as Error).message },
          "Submit execution failed"
        );
        reply.code(500).send({
          status: "error",
          errorCode: "HOST_ERROR",
          errorMessage: (err as Error).message,
        });
      }
    }
  );
}
