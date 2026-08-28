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
import {ConfigRegistry} from "../config-registry.js";
import {PluginManager} from "../plugin-manager.js";
import {AppConfig} from "../config.js";
import {EventConsumerManager} from "../rabbitmq/event-consumer.js";
import type {Endpoint, EventBrokerConfig} from "../models/index.js";
import {createHmacAuthHook} from "../security/hmac-auth.js";
import {checkContentPin} from "../security/content-pin.js";

const EXCHANGE_TYPES = ["fanout", "topic", "direct"] as const;
const QUEUE_MODES = ["live", "durable"] as const;
const MIN_QUEUE_TTL_MS = 60 * 60 * 1000;
const MAX_QUEUE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_QUEUE_TTL_MS = 72 * 60 * 60 * 1000;

/**
 * Normalizes the `eventBroker` field GZAC sends with a configuration. Returns `undefined` (events
 * disabled for the configuration) when no `amqpUrl` is supplied; defaults the exchange/type so GZAC
 * only has to send the URL for the common topology. Also normalizes the per-host queue mode and
 * TTL: an unknown/absent mode defaults to `"live"`; a durable-mode TTL outside the documented
 * [1h, 30d] window is clamped (defensive — GZAC validates the same bounds before pushing).
 */
function normalizeEventBroker(input: unknown): EventBrokerConfig | undefined {
  if (!input || typeof input !== "object") return undefined;
  const b = input as Record<string, unknown>;
  const amqpUrl = typeof b.amqpUrl === "string" ? b.amqpUrl.trim() : "";
  if (!amqpUrl) return undefined;
  const exchange =
    typeof b.exchange === "string" && b.exchange.length > 0 ? b.exchange : "valtimo-events";
  const typeRaw = typeof b.exchangeType === "string" ? b.exchangeType : "fanout";
  const exchangeType = (EXCHANGE_TYPES as readonly string[]).includes(typeRaw)
    ? (typeRaw as EventBrokerConfig["exchangeType"])
    : "fanout";
  const modeRaw = typeof b.queueMode === "string" ? b.queueMode : "live";
  const queueMode: "live" | "durable" = (QUEUE_MODES as readonly string[]).includes(modeRaw)
    ? (modeRaw as "live" | "durable")
    : "live";
  let queueTtlMs: number | undefined;
  if (queueMode === "durable") {
    const rawTtl = typeof b.queueTtlMs === "number" ? b.queueTtlMs : DEFAULT_QUEUE_TTL_MS;
    queueTtlMs = Math.min(Math.max(rawTtl, MIN_QUEUE_TTL_MS), MAX_QUEUE_TTL_MS);
  }
  return { amqpUrl, exchange, exchangeType, queueMode, queueTtlMs };
}

/**
 * Normalizes the optional `ownerId` a GZAC push carries — the pushing GZAC's host-row UUID,
 * treated as an opaque token here. Absent or malformed values mean "unowned": the configuration is
 * then excluded from every GZAC's reconciliation pass (older GZAC instances don't send an owner).
 */
function normalizeOwnerId(input: unknown): string | undefined {
  return typeof input === "string" && input.length > 0 ? input : undefined;
}

/**
 * Normalizes a string-array field from a GZAC push body (eventSubscriptions, grantedCapabilities).
 * Treats anything that isn't an array of strings as an empty list.
 */
function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((x): x is string => typeof x === "string" && x.length > 0);
}

/**
 * Normalizes the `grantedEndpoints` list from a GZAC push body. Returns `undefined` when the push
 * carries no array at all — an older GZAC instance that doesn't send granted endpoints — which the
 * host treats as "no host-side allowlist" (warn + allow; GZAC still enforces server-side). A pushed
 * array is filtered down to well-formed `{method, pattern}` entries; an empty result denies all.
 */
function normalizeEndpoints(input: unknown): Endpoint[] | undefined {
  if (!Array.isArray(input)) return undefined;
  return input
    .filter(
      (x): x is Endpoint =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as Endpoint).method === "string" &&
        (x as Endpoint).method.length > 0 &&
        typeof (x as Endpoint).pattern === "string" &&
        (x as Endpoint).pattern.length > 0
    )
    .map((x) => ({ method: x.method, pattern: x.pattern }));
}

/**
 * Configuration push endpoints.
 *
 * GZAC pushes decrypted configuration here on activation.
 * The host stores it in-memory and injects it into every Wasm call.
 *
 * Authentication: HMAC-SHA256 over `{method}\n{path}\n{timestamp}\n{bodyHash}` using the host's
 * ADMIN_TOKEN as the key (same scheme as the action route). The signature binds the request body —
 * which carries a freshly issued service token and broker credentials — and the ±5-minute timestamp
 * window blocks replay.
 */
export async function hostConfigurationRoutes(
  fastify: FastifyInstance,
  opts: {
    configRegistry: ConfigRegistry;
    pluginManager: PluginManager;
    config: AppConfig;
    eventConsumerManager: EventConsumerManager;
  }
): Promise<void> {
  const { configRegistry, pluginManager, config, eventConsumerManager } = opts;

  // Authenticate every configuration route by HMAC signature. Write routes opt in to raw-body
  // capture (config.rawBody) so the signature binds the pushed body; GET/DELETE bind an empty body.
  fastify.addHook("preHandler", createHmacAuthHook(config.ADMIN_TOKEN));

  /**
   * POST /api/host/configurations/:configId — push configuration from GZAC
   */
  fastify.post<{
    Params: { configId: string };
    Body: {
      pluginId: string;
      pluginVersion: string;
      properties: Record<string, unknown>;
      serviceToken: string;
      gzacBaseUrl: string;
      expectedContentHash?: unknown;
      eventSubscriptions?: unknown;
      grantedCapabilities?: unknown;
      grantedEndpoints?: unknown;
      allowedEgress?: unknown;
      eventBroker?: unknown;
      ownerId?: unknown;
    };
  }>("/api/host/configurations/:configId", { config: { rawBody: true } }, async (request, reply) => {
    const { configId } = request.params;
    const { pluginId, pluginVersion, properties, serviceToken, gzacBaseUrl } =
      request.body;

    if (!serviceToken || typeof serviceToken !== "string") {
      reply
        .code(400)
        .send({ error: "Missing required field: serviceToken" });
      return;
    }
    if (!gzacBaseUrl || typeof gzacBaseUrl !== "string") {
      reply
        .code(400)
        .send({ error: "Missing required field: gzacBaseUrl" });
      return;
    }

    // Verify the plugin is loaded
    const manifest = pluginManager.getManifest(pluginId, pluginVersion);
    if (!manifest) {
      reply.code(404).send({
        error: `Plugin not loaded: ${pluginId}@${pluginVersion}`,
      });
      return;
    }

    // GZAC pins the package content hash it discovered and sends it with every push. Refusing a
    // mismatch here means a config (and its fresh service token) can never be handed to plugin
    // code that differs from what the admin accepted — even in the window between GZAC's
    // discovery cycle and this push.
    const expectedContentHash =
      typeof request.body.expectedContentHash === "string" &&
      request.body.expectedContentHash.length > 0
        ? request.body.expectedContentHash
        : undefined;
    if (expectedContentHash) {
      const actualContentHash = pluginManager.getContentHash(pluginId, pluginVersion);
      if (actualContentHash !== expectedContentHash) {
        request.log.warn(
          { configId, pluginId, pluginVersion, expectedContentHash, actualContentHash },
          "Configuration push refused: package content hash mismatch"
        );
        reply.code(409).send({
          error: `Package content hash mismatch for ${pluginId}@${pluginVersion}`,
          expectedContentHash,
          actualContentHash,
        });
        return;
      }
    }

    const eventBroker = normalizeEventBroker(request.body.eventBroker);
    const eventSubscriptions = normalizeStringArray(request.body.eventSubscriptions);
    const grantedCapabilities = normalizeStringArray(request.body.grantedCapabilities);
    const grantedEndpoints = normalizeEndpoints(request.body.grantedEndpoints);
    // No "not pushed" case for egress: http_request is deny-by-default, so an older GZAC that sends
    // no list leaves the configuration unable to make outbound calls until it is upgraded. Logged
    // below when the capability is granted but the list is empty, since that combination is
    // otherwise silent.
    const allowedEgress = normalizeStringArray(request.body.allowedEgress);
    const ownerId = normalizeOwnerId(request.body.ownerId);

    // An owner change on an existing configuration is the fingerprint of two GZAC environments
    // pushing the same configuration id (e.g. database-cloned environments pointed at the same
    // host) — configs will flap between owners and reconciliation may ping-pong. Surface it loudly.
    const existing = await configRegistry.get(configId);
    if (existing?.ownerId && ownerId && existing.ownerId !== ownerId) {
      request.log.warn(
        { configId, previousOwnerId: existing.ownerId, ownerId },
        "Configuration owner changed — two GZAC environments may be pushing the same configuration id"
      );
    }

    await configRegistry.set(configId, {
      configurationId: configId,
      pluginId,
      pluginVersion,
      properties: properties || {},
      serviceToken,
      gzacBaseUrl,
      eventSubscriptions,
      grantedCapabilities,
      grantedEndpoints,
      allowedEgress,
      eventBroker,
      ownerId,
      expectedContentHash,
    });
    await eventConsumerManager.sync();

    if (grantedCapabilities.includes("http_request") && allowedEgress.length === 0) {
      request.log.warn(
        { configId, pluginId, pluginVersion },
        "Configuration has the http_request capability but no egress targets — every outbound call will be refused"
      );
    }

    request.log.info(
      {
        configId,
        pluginId,
        pluginVersion,
        gzacBaseUrl,
        eventBroker: eventBroker?.exchange ?? null,
        eventSubscriptionCount: eventSubscriptions.length,
        allowedEgressCount: allowedEgress.length,
      },
      "Configuration pushed"
    );
    reply.code(201).send({ configurationId: configId });
  });

  /**
   * PUT /api/host/configurations/:configId — update configuration
   */
  fastify.put<{
    Params: { configId: string };
    Body: {
      properties: Record<string, unknown>;
      serviceToken?: string;
      gzacBaseUrl?: string;
      eventSubscriptions?: unknown;
      grantedEndpoints?: unknown;
      allowedEgress?: unknown;
      eventBroker?: unknown;
      ownerId?: unknown;
    };
  }>("/api/host/configurations/:configId", { config: { rawBody: true } }, async (request, reply) => {
    const { configId } = request.params;
    const existing = await configRegistry.get(configId);

    if (!existing) {
      reply.code(404).send({ error: `Configuration not found: ${configId}` });
      return;
    }

    // Checked against the stored pin, not a body field: re-reading it from an update body would
    // let a caller switch the check off by omitting it.
    const contentRefusal = checkContentPin(existing, pluginManager, request.log);
    if (contentRefusal) {
      reply.code(409).send(contentRefusal);
      return;
    }

    // Only replace the broker when the update actually carries one; otherwise keep what's stored.
    const eventBroker =
      "eventBroker" in request.body
        ? normalizeEventBroker(request.body.eventBroker)
        : existing.eventBroker;
    // Same shape for the granted event-subscription list — only replace when supplied.
    const eventSubscriptions =
      "eventSubscriptions" in request.body
        ? normalizeStringArray(request.body.eventSubscriptions)
        : existing.eventSubscriptions;
    // And the granted endpoint allowlist — only replace when supplied.
    const grantedEndpoints =
      "grantedEndpoints" in request.body
        ? normalizeEndpoints(request.body.grantedEndpoints)
        : existing.grantedEndpoints;
    // And the egress allowlist — an update that doesn't mention it keeps the accepted set rather
    // than silently revoking every destination.
    const allowedEgress =
      "allowedEgress" in request.body
        ? normalizeStringArray(request.body.allowedEgress)
        : existing.allowedEgress;
    // The owner too — an update from a client that doesn't send one must not unclaim the config.
    const ownerId =
      "ownerId" in request.body ? normalizeOwnerId(request.body.ownerId) : existing.ownerId;

    await configRegistry.set(configId, {
      ...existing,
      properties: request.body.properties || {},
      serviceToken: request.body.serviceToken ?? existing.serviceToken,
      gzacBaseUrl: request.body.gzacBaseUrl ?? existing.gzacBaseUrl,
      eventSubscriptions,
      grantedEndpoints,
      allowedEgress,
      eventBroker,
      ownerId,
    });
    await eventConsumerManager.sync();

    reply.code(200).send({ configurationId: configId });
  });

  /**
   * DELETE /api/host/configurations/:configId — remove configuration
   */
  fastify.delete<{ Params: { configId: string } }>(
    "/api/host/configurations/:configId",
    async (request, reply) => {
      const deleted = await configRegistry.delete(request.params.configId);
      if (!deleted) {
        reply.code(404).send({
          error: `Configuration not found: ${request.params.configId}`,
        });
        return;
      }
      await eventConsumerManager.sync();
      reply.code(204).send();
    }
  );

  /**
   * GET /api/host/configurations — list all configurations, as summaries.
   *
   * Deliberately redacted: a host serves multiple GZAC instances, and this listing exists so each
   * GZAC can reconcile (delete its own orphans). Returning full configurations would hand every
   * ADMIN_TOKEN holder the service tokens, decrypted properties and broker credentials of *other*
   * GZAC instances. `ownerId` is `null` for configurations pushed by a GZAC that predates
   * ownership — reconciliation never touches those.
   */
  fastify.get("/api/host/configurations", async () => {
    const configs = await configRegistry.list();
    return configs.map((config) => ({
      configurationId: config.configurationId,
      pluginId: config.pluginId,
      pluginVersion: config.pluginVersion,
      ownerId: config.ownerId ?? null,
    }));
  });
}
