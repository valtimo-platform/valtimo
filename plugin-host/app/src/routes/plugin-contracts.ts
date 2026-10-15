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

import type {FastifyInstance, FastifyReply, FastifyRequest} from "fastify";
import {PluginManager} from "../plugin-manager.js";
import {ConfigRegistry} from "../config-registry.js";
import type {AppConfig} from "../config.js";
import type {PluginConfiguration} from "../models/index.js";
import {createHmacAuthHook} from "../security/hmac-auth.js";
import {checkContentPin} from "../security/content-pin.js";
import {MissingPluginExportError} from "../errors.js";

/** Chain entries become a header value; anything that could break it is dropped. */
const CHAIN_ENTRY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function normalizeChain(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((x): x is string => typeof x === "string" && CHAIN_ENTRY_PATTERN.test(x));
}

function hostError(errorCode: string, errorMessage: string) {
  return { status: "error", errorCode, errorMessage };
}

/**
 * Contract delivery endpoints — GZAC brokering a contract call or job to a provider, and a job's
 * outcome back to its requester. Same rails as the action route: HMAC-signed by GZAC, configuration
 * looked up from the pushed registry, content pin enforced, service token injected host-side only.
 *
 * Plugin-level outcomes (`completed` / `accepted` / `error`) all answer 200; GZAC decides what an
 * `error` means for the caller. Non-200s are host-level refusals.
 */
export async function pluginContractRoutes(
  fastify: FastifyInstance,
  opts: { pluginManager: PluginManager; configRegistry: ConfigRegistry; config: AppConfig }
): Promise<void> {
  const { pluginManager, configRegistry, config } = opts;
  const routeOptions = {
    config: { rawBody: true },
    preHandler: createHmacAuthHook(config.ADMIN_TOKEN),
  };

  /**
   * Shared checks for both routes. Answers the refusal itself and returns `null`, or returns the
   * configuration the Wasm may run for.
   */
  async function resolveConfiguration(
    request: FastifyRequest,
    reply: FastifyReply,
    pluginId: string,
    version: string,
    configurationId: unknown
  ): Promise<(PluginConfiguration & { serviceToken: string; gzacBaseUrl: string }) | null> {
    if (!pluginManager.getManifest(pluginId, version)) {
      reply.code(404).send({ error: `Plugin not found: ${pluginId}@${version}` });
      return null;
    }
    if (typeof configurationId !== "string" || configurationId.length === 0) {
      reply.code(400).send({ error: "Missing required field: configurationId" });
      return null;
    }
    const pluginConfig = await configRegistry.get(configurationId);
    if (!pluginConfig) {
      reply.code(404).send({
        error: `Configuration not found: ${configurationId}. GZAC may need to re-sync configurations.`,
      });
      return null;
    }
    if (pluginConfig.pluginId !== pluginId || pluginConfig.pluginVersion !== version) {
      reply.code(400).send({
        error: `Configuration ${configurationId} targets ${pluginConfig.pluginId}@${pluginConfig.pluginVersion}, not ${pluginId}@${version}`,
      });
      return null;
    }
    const contentRefusal = checkContentPin(pluginConfig, pluginManager, request.log);
    if (contentRefusal) {
      reply.code(409).send(contentRefusal);
      return null;
    }
    return pluginConfig as PluginConfiguration & { serviceToken: string; gzacBaseUrl: string };
  }

  function missingCallbackContext(reply: FastifyReply, pluginConfig: PluginConfiguration): boolean {
    if (pluginConfig.serviceToken && pluginConfig.gzacBaseUrl) return false;
    reply
      .code(500)
      .send(
        hostError(
          "MISSING_CALLBACK_CONTEXT",
          `Configuration ${pluginConfig.configurationId} is missing serviceToken or gzacBaseUrl. GZAC must re-push the configuration before this plugin can call back.`
        )
      );
    return true;
  }

  /**
   * POST /plugins/:pluginId/:version/contracts/:contract/:operation
   *
   * Body: { configurationId, caller: {pluginId, version, configurationId}, payload,
   *         jobId?, deadline?, chain?: string[] }
   */
  fastify.post<{
    Params: { pluginId: string; version: string; contract: string; operation: string };
    Body: {
      configurationId?: unknown;
      caller?: unknown;
      payload?: unknown;
      jobId?: unknown;
      deadline?: unknown;
      chain?: unknown;
    };
  }>("/plugins/:pluginId/:version/contracts/:contract/:operation", routeOptions, async (request, reply) => {
    const { pluginId, version, contract, operation } = request.params;
    const body = request.body ?? {};

    const pluginConfig = await resolveConfiguration(request, reply, pluginId, version, body.configurationId);
    if (!pluginConfig) return;

    // Only operations the loaded manifest declares are callable — never a stray handler.
    const manifest = pluginManager.getManifest(pluginId, version);
    const provided = manifest?.provides
      ?.find((p) => p.contract === contract)
      ?.operations?.some((op) => op.key === operation);
    if (!provided) {
      reply
        .code(404)
        .send(
          hostError(
            "CONTRACT_OPERATION_NOT_PROVIDED",
            `${pluginId}@${version} does not provide operation '${operation}' of '${contract}'`
          )
        );
      return;
    }

    if (missingCallbackContext(reply, pluginConfig)) return;

    const caller =
      body.caller && typeof body.caller === "object" && !Array.isArray(body.caller)
        ? (body.caller as Record<string, unknown>)
        : {};
    const chain = normalizeChain(body.chain);
    if (chain.at(-1) !== pluginConfig.configurationId) chain.push(pluginConfig.configurationId);

    try {
      const result = await pluginManager.callContract(pluginId, version, contract, operation, {
        configurationId: pluginConfig.configurationId,
        configuration: pluginConfig.properties,
        caller,
        payload: body.payload ?? {},
        ...(typeof body.jobId === "string" && body.jobId ? { jobId: body.jobId } : {}),
        ...(typeof body.deadline === "string" && body.deadline ? { deadline: body.deadline } : {}),
        chain,
        serviceToken: pluginConfig.serviceToken,
        gzacBaseUrl: pluginConfig.gzacBaseUrl,
      });
      reply.code(200).send(result);
    } catch (err) {
      if (err instanceof MissingPluginExportError) {
        reply
          .code(501)
          .send(hostError("CONTRACT_NOT_IMPLEMENTED", `${pluginId}@${version} was built without contract support`));
        return;
      }
      request.log.error(
        { pluginId, version, contract, operation, error: (err as Error).message },
        "Contract call execution failed"
      );
      reply.code(500).send(hostError("HOST_ERROR", (err as Error).message));
    }
  });

  /**
   * POST /plugins/:pluginId/:version/contract-replies
   *
   * Body: { configurationId, jobId, contract, operation, status: "completed"|"failed"|"expired",
   *         result?, errorCode?, errorMessage?, requestedAt, completedAt? }
   */
  fastify.post<{
    Params: { pluginId: string; version: string };
    Body: Record<string, unknown>;
  }>("/plugins/:pluginId/:version/contract-replies", routeOptions, async (request, reply) => {
    const { pluginId, version } = request.params;
    const body = request.body ?? {};

    const pluginConfig = await resolveConfiguration(request, reply, pluginId, version, body.configurationId);
    if (!pluginConfig) return;

    for (const field of ["jobId", "contract", "operation", "status"] as const) {
      if (typeof body[field] !== "string" || (body[field] as string).length === 0) {
        reply.code(400).send({ error: `Missing required field: ${field}` });
        return;
      }
    }

    if (missingCallbackContext(reply, pluginConfig)) return;

    const optionalString = (value: unknown) => (typeof value === "string" ? value : undefined);
    try {
      const result = await pluginManager.callContractReply(pluginId, version, {
        configurationId: pluginConfig.configurationId,
        configuration: pluginConfig.properties,
        jobId: body.jobId as string,
        contract: body.contract as string,
        operation: body.operation as string,
        status: body.status as string,
        result: body.result,
        errorCode: optionalString(body.errorCode),
        errorMessage: optionalString(body.errorMessage),
        requestedAt: optionalString(body.requestedAt),
        completedAt: optionalString(body.completedAt),
        serviceToken: pluginConfig.serviceToken,
        gzacBaseUrl: pluginConfig.gzacBaseUrl,
      });
      reply.code(200).send(result);
    } catch (err) {
      if (err instanceof MissingPluginExportError) {
        reply
          .code(501)
          .send(
            hostError("CONTRACT_REPLY_NOT_IMPLEMENTED", `${pluginId}@${version} was built without contract-reply support`)
          );
        return;
      }
      request.log.error(
        { pluginId, version, jobId: body.jobId, error: (err as Error).message },
        "Contract reply execution failed"
      );
      reply.code(500).send(hostError("HOST_ERROR", (err as Error).message));
    }
  });
}
