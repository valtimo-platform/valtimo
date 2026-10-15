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
import {CORRELATION_ID_HEADER, CORRELATION_ID_PATTERN} from "../host-functions/plugin-contract.js";

/** Chain entries become a header value; anything that could break it is dropped. */
const CHAIN_ENTRY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function normalizeChain(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((x): x is string => typeof x === "string" && CHAIN_ENTRY_PATTERN.test(x));
}

function parseTimeoutMs(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

/** Epoch ms of an ISO-8601 instant (zone required), else undefined. */
function parseInstant(value: unknown): number | undefined {
  if (typeof value !== "string" || !INSTANT_PATTERN.test(value)) return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
}

/** Malformed or repeated → ignored, not refused: the id only labels logs and onward hops. */
function readCorrelationId(request: FastifyRequest): string | undefined {
  const value = request.headers[CORRELATION_ID_HEADER.toLowerCase()];
  return typeof value === "string" && CORRELATION_ID_PATTERN.test(value) ? value : undefined;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function hostError(errorCode: string, errorMessage: string) {
  return { status: "error", errorCode, errorMessage };
}

/**
 * Contract delivery endpoints — GZAC brokering a contract call or job to a provider, and a job's
 * outcome back to its requester. Same rails as the action route: HMAC-signed by GZAC, configuration
 * looked up from the pushed registry, content pin enforced, service token injected host-side only.
 * A valid `X-Valtimo-Correlation-Id` labels the route's logs and every `plugin_contract` hop the
 * invocation makes.
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
   * configuration the Wasm may run for. The two 404s carry a code so GZAC can tell a provider that is
   * temporarily unavailable from one that lacks the route.
   */
  async function resolveConfiguration(
    request: FastifyRequest,
    reply: FastifyReply,
    pluginId: string,
    version: string,
    configurationId: unknown
  ): Promise<(PluginConfiguration & { serviceToken: string; gzacBaseUrl: string }) | null> {
    if (!pluginManager.getManifest(pluginId, version)) {
      reply.code(404).send(hostError("PLUGIN_NOT_LOADED", `Plugin not loaded: ${pluginId}@${version}`));
      return null;
    }
    if (typeof configurationId !== "string" || configurationId.length === 0) {
      reply.code(400).send({ error: "Missing required field: configurationId" });
      return null;
    }
    const pluginConfig = await configRegistry.get(configurationId);
    if (!pluginConfig) {
      reply
        .code(404)
        .send(
          hostError(
            "CONFIGURATION_NOT_FOUND",
            `Configuration not found: ${configurationId}. GZAC may need to re-sync configurations.`
          )
        );
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
   * Body: { configurationId, caller: {pluginId, version, configurationId}, payload, chain?: string[],
   *         timeoutMs? (synchronous call), jobId?, deadline?, documentId?, requestedBy? (job) }
   *
   * A synchronous call's `timeoutMs` bounds the invocation and becomes the Wasm's `deadline` on this
   * host's clock; a job's `deadline` reaches the Wasm as given.
   */
  fastify.post<{
    Params: { pluginId: string; version: string; contract: string; operation: string };
    Body: {
      configurationId?: unknown;
      caller?: unknown;
      payload?: unknown;
      jobId?: unknown;
      deadline?: unknown;
      timeoutMs?: unknown;
      documentId?: unknown;
      requestedBy?: unknown;
      chain?: unknown;
    };
  }>("/plugins/:pluginId/:version/contracts/:contract/:operation", routeOptions, async (request, reply) => {
    const { pluginId, version, contract, operation } = request.params;
    const body = request.body ?? {};
    const correlationId = readCorrelationId(request);
    const log = correlationId ? request.log.child({ correlationId }) : request.log;

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
    const jobId = nonEmptyString(body.jobId);
    const timeoutMs = parseTimeoutMs(body.timeoutMs);
    const contractDeadlineMs = timeoutMs === undefined ? undefined : Date.now() + timeoutMs;
    const deadline =
      contractDeadlineMs !== undefined
        ? new Date(contractDeadlineMs).toISOString()
        : parseInstant(body.deadline) !== undefined
          ? (body.deadline as string)
          : undefined;

    const start = Date.now();
    try {
      const result = await pluginManager.callContract(pluginId, version, contract, operation, {
        configurationId: pluginConfig.configurationId,
        configuration: pluginConfig.properties,
        caller,
        payload: body.payload ?? {},
        jobId,
        deadline,
        documentId: nonEmptyString(body.documentId),
        requestedBy: nonEmptyString(body.requestedBy),
        chain,
        contractDeadlineMs,
        correlationId,
        serviceToken: pluginConfig.serviceToken,
        gzacBaseUrl: pluginConfig.gzacBaseUrl,
      });
      log.info(
        { pluginId, version, contract, operation, jobId, status: result.status, durationMs: Date.now() - start },
        "Contract call delivered"
      );
      reply.code(200).send(result);
    } catch (err) {
      if (err instanceof MissingPluginExportError) {
        reply
          .code(501)
          .send(hostError("CONTRACT_NOT_IMPLEMENTED", `${pluginId}@${version} was built without contract support`));
        return;
      }
      log.error(
        { pluginId, version, contract, operation, jobId, error: (err as Error).message },
        "Contract call execution failed"
      );
      reply.code(500).send(hostError("HOST_ERROR", (err as Error).message));
    }
  });

  /**
   * POST /plugins/:pluginId/:version/contract-replies
   *
   * Body: { configurationId, jobId, contract, operation, status: "completed"|"failed"|"expired",
   *         result?, errorCode?, providerErrorCode?, errorMessage?, requestedAt, completedAt? }
   */
  fastify.post<{
    Params: { pluginId: string; version: string };
    Body: Record<string, unknown>;
  }>("/plugins/:pluginId/:version/contract-replies", routeOptions, async (request, reply) => {
    const { pluginId, version } = request.params;
    const body = request.body ?? {};
    const correlationId = readCorrelationId(request);
    const log = correlationId ? request.log.child({ correlationId }) : request.log;

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
    const start = Date.now();
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
        providerErrorCode: optionalString(body.providerErrorCode),
        errorMessage: optionalString(body.errorMessage),
        requestedAt: optionalString(body.requestedAt),
        completedAt: optionalString(body.completedAt),
        correlationId,
        serviceToken: pluginConfig.serviceToken,
        gzacBaseUrl: pluginConfig.gzacBaseUrl,
      });
      log.info(
        {
          pluginId,
          version,
          jobId: body.jobId,
          contract: body.contract,
          operation: body.operation,
          replyStatus: body.status,
          status: result.status,
          durationMs: Date.now() - start,
        },
        "Contract reply delivered"
      );
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
      log.error(
        { pluginId, version, jobId: body.jobId, error: (err as Error).message },
        "Contract reply execution failed"
      );
      reply.code(500).send(hostError("HOST_ERROR", (err as Error).message));
    }
  });
}
