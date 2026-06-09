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

import {FastifyInstance, FastifyReply, FastifyRequest} from "fastify";
import {ConfigRegistry} from "../config-registry.js";
import {PluginManager} from "../plugin-manager.js";
import {AppConfig} from "../config.js";
import {EventConsumerManager} from "../rabbitmq/event-consumer.js";
import type {EventBrokerConfig} from "../models/index.js";

const EXCHANGE_TYPES = ["fanout", "topic", "direct"] as const;

/**
 * Normalizes the `eventBroker` field GZAC sends with a configuration. Returns `undefined` (events
 * disabled for the configuration) when no `amqpUrl` is supplied; defaults the exchange/type so GZAC
 * only has to send the URL for the common topology.
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
  return { amqpUrl, exchange, exchangeType };
}

/**
 * Configuration push endpoints.
 *
 * GZAC pushes decrypted configuration here on activation.
 * The host stores it in-memory and injects it into every Wasm call.
 *
 * POC: simplified auth — uses ADMIN_TOKEN. Production: HMAC per GZAC instance.
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

  // Admin auth hook
  fastify.addHook(
    "onRequest",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authHeader = request.headers["authorization"];
      if (!authHeader) {
        reply.code(401).send({ error: "Missing Authorization header" });
        return;
      }

      const token = authHeader.replace(/^Bearer\s+/i, "");
      if (token !== config.ADMIN_TOKEN) {
        reply.code(403).send({ error: "Invalid admin token" });
        return;
      }
    }
  );

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
      eventBroker?: unknown;
    };
  }>("/api/host/configurations/:configId", async (request, reply) => {
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

    await configRegistry.set(configId, {
      configurationId: configId,
      pluginId,
      pluginVersion,
      properties: properties || {},
      serviceToken,
      gzacBaseUrl,
      eventBroker,
    });
    await eventConsumerManager.sync();

    request.log.info(
      { configId, pluginId, pluginVersion, gzacBaseUrl, eventBroker: eventBroker?.exchange ?? null },
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
      eventBroker?: unknown;
    };
  }>("/api/host/configurations/:configId", async (request, reply) => {
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

    await configRegistry.set(configId, {
      ...existing,
      properties: request.body.properties || {},
      serviceToken: request.body.serviceToken ?? existing.serviceToken,
      gzacBaseUrl: request.body.gzacBaseUrl ?? existing.gzacBaseUrl,
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
