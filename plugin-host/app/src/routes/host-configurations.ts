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
import type {EventBrokerConfig} from "../models/index.js";
import {createHmacAuthHook} from "../security/hmac-auth.js";

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
 * Normalizes the `eventSubscriptions` field GZAC sends with a configuration. Treats anything that
 * isn't an array of strings as an empty list — defense in depth so the dispatcher's allowlist
 * check (§event-consumer) never blows up on a malformed push.
 */
function normalizeEventSubscriptions(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((x): x is string => typeof x === "string" && x.length > 0);
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
      eventSubscriptions?: unknown;
      eventBroker?: unknown;
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

    const eventBroker = normalizeEventBroker(request.body.eventBroker);
    const eventSubscriptions = normalizeEventSubscriptions(request.body.eventSubscriptions);

    await configRegistry.set(configId, {
      configurationId: configId,
      pluginId,
      pluginVersion,
      properties: properties || {},
      serviceToken,
      gzacBaseUrl,
      eventSubscriptions,
      eventBroker,
    });
    await eventConsumerManager.sync();

    request.log.info(
      {
        configId,
        pluginId,
        pluginVersion,
        gzacBaseUrl,
        eventBroker: eventBroker?.exchange ?? null,
        eventSubscriptionCount: eventSubscriptions.length,
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
      eventBroker?: unknown;
    };
  }>("/api/host/configurations/:configId", { config: { rawBody: true } }, async (request, reply) => {
    const { configId } = request.params;
    const existing = await configRegistry.get(configId);

    if (!existing) {
      reply.code(404).send({ error: `Configuration not found: ${configId}` });
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
        ? normalizeEventSubscriptions(request.body.eventSubscriptions)
        : existing.eventSubscriptions;

    await configRegistry.set(configId, {
      ...existing,
      properties: request.body.properties || {},
      serviceToken: request.body.serviceToken ?? existing.serviceToken,
      gzacBaseUrl: request.body.gzacBaseUrl ?? existing.gzacBaseUrl,
      eventSubscriptions,
      eventBroker,
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
   * GET /api/host/configurations — list all configurations
   */
  fastify.get("/api/host/configurations", async () => {
    return configRegistry.list();
  });
}
