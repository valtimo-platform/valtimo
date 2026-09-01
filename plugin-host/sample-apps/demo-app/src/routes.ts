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

import type { FastifyInstance, FastifyReply } from "fastify";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AppConfig } from "./config.js";
import { createHmacAuthHook } from "./hmac.js";
import { manifest, PLUGIN_ID, PLUGIN_VERSION } from "./manifest.js";
import { handleRequest, runAction } from "./plugin.js";
import type { ConfigRecord, ConfigStore, EventBrokerConfig } from "./store.js";

// public/ (built frontend bundles) and logo.svg both sit at the project root, one level up from
// this module whether it runs from src/ (tsx) or dist/ (tsc build).
const PUBLIC_DIR = fileURLToPath(new URL("../public", import.meta.url));
const LOGO_PATH = fileURLToPath(new URL("../logo.svg", import.meta.url));

const MIME_TYPES: Record<string, string> = {
  ".js": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};

const MIN_QUEUE_TTL_MS = 3_600_000;
const MAX_QUEUE_TTL_MS = 2_592_000_000;

/** Mirrors the plugin host's defensive normalisation of the pushed broker block. */
function normalizeEventBroker(raw: unknown): EventBrokerConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.amqpUrl !== "string" || !b.amqpUrl) return null;
  const queueMode = b.queueMode === "durable" ? "durable" : "live";
  let queueTtlMs: number | null = null;
  if (queueMode === "durable") {
    const ttl = typeof b.queueTtlMs === "number" ? b.queueTtlMs : 259_200_000;
    queueTtlMs = Math.min(Math.max(ttl, MIN_QUEUE_TTL_MS), MAX_QUEUE_TTL_MS);
  }
  return {
    amqpUrl: b.amqpUrl,
    exchange: typeof b.exchange === "string" && b.exchange ? b.exchange : "valtimo-events",
    exchangeType: typeof b.exchangeType === "string" && b.exchangeType ? b.exchangeType : "fanout",
    queueMode,
    queueTtlMs,
  };
}

function normalizeSubscriptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is string => typeof t === "string" && t.length > 0);
}

async function serveFile(reply: FastifyReply, fullPath: string, csp?: string): Promise<void> {
  if (!existsSync(fullPath)) {
    reply.code(404).header("Access-Control-Allow-Origin", "*").send({ error: "Not found" });
    return;
  }
  if (csp) reply.header("Content-Security-Policy", csp);
  const content = await readFile(fullPath);
  reply
    .header("Content-Type", MIME_TYPES[extname(fullPath)] ?? "application/octet-stream")
    .header("Cache-Control", "public, max-age=3600")
    .header("Access-Control-Allow-Origin", "*")
    .send(content);
}

export interface RouteDeps {
  config: AppConfig;
  store: ConfigStore;
  /** Called after any configuration mutation so the caller can re-sync event consumers. */
  onConfigsChanged: () => void | Promise<void>;
}

export async function registerRoutes(fastify: FastifyInstance, deps: RouteDeps): Promise<void> {
  const { config, store } = deps;
  const hmac = createHmacAuthHook(config.ADMIN_TOKEN);
  const pluginBase = `/plugins/:pluginId/:version`;

  // ---- Health (public) ----
  fastify.get("/health", async () => ({ status: "UP" }));

  // ---- Discovery: the single plugin this app serves (HMAC) ----
  fastify.get("/api/host/plugins", { preHandler: hmac }, async () => [
    { pluginId: PLUGIN_ID, version: PLUGIN_VERSION, manifest },
  ]);

  // ---- GZAC instance announcement (HMAC) ----
  // Each connecting GZAC announces its own base URL plus the browser origins allowed to frame this
  // app's plugin screens; the union becomes the bundles' `frame-ancestors` CSP. In memory, keyed by
  // gzacBaseUrl, matching the config store's philosophy: GZAC re-announces on every discovery poll,
  // so a restart converges within one cycle. With nothing announced yet the policy is 'none' —
  // fail closed, exactly like the plugin host.
  const frameAncestors = new Map<string, string[]>();
  const frameAncestorsCsp = (): string => {
    const origins = [...new Set([...frameAncestors.values()].flat())];
    return `frame-ancestors ${origins.length ? origins.join(" ") : "'none'"}`;
  };

  fastify.put(
    "/api/host/gzac-instances",
    { preHandler: hmac, config: { rawBody: true } },
    async (request, reply) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const gzacBaseUrl = body.gzacBaseUrl;
      const origins = body.frontendOrigins;
      if (typeof gzacBaseUrl !== "string" || !gzacBaseUrl || !Array.isArray(origins)) {
        reply.code(400).send({ error: "Invalid body: expected {gzacBaseUrl, frontendOrigins[]}" });
        return;
      }
      const frontendOrigins = origins.filter(
        (o): o is string => typeof o === "string" && /^https?:\/\/[^/\s]+$/.test(o),
      );
      frameAncestors.set(gzacBaseUrl, frontendOrigins);
      request.log.info(
        `[demo-app] GZAC instance ${gzacBaseUrl} registered as frame ancestor (${frontendOrigins.join(", ") || "no origins"})`,
      );
      reply.code(200).send({ gzacBaseUrl, frontendOrigins });
    },
  );

  // ---- Configuration push / update / delete / list (HMAC) ----
  fastify.post<{ Params: { configId: string } }>(
    "/api/host/configurations/:configId",
    { preHandler: hmac, config: { rawBody: true } },
    async (request, reply) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      if (typeof body.serviceToken !== "string" || typeof body.gzacBaseUrl !== "string") {
        reply.code(400).send({ error: "Missing required field: serviceToken and/or gzacBaseUrl" });
        return;
      }
      const record: ConfigRecord = {
        configurationId: request.params.configId,
        pluginId: (body.pluginId as string) ?? PLUGIN_ID,
        pluginVersion: (body.pluginVersion as string) ?? PLUGIN_VERSION,
        properties: (body.properties as Record<string, unknown>) ?? {},
        serviceToken: body.serviceToken,
        gzacBaseUrl: body.gzacBaseUrl,
        eventSubscriptions: normalizeSubscriptions(body.eventSubscriptions),
        eventBroker: normalizeEventBroker(body.eventBroker),
        ownerId: typeof body.ownerId === "string" && body.ownerId ? body.ownerId : null,
      };
      store.set(record);
      await deps.onConfigsChanged();
      request.log.info(`[demo-app] configuration ${record.configurationId} pushed`);
      reply.code(201).send({ configurationId: record.configurationId });
    },
  );

  fastify.put<{ Params: { configId: string } }>(
    "/api/host/configurations/:configId",
    { preHandler: hmac, config: { rawBody: true } },
    async (request, reply) => {
      const existing = store.get(request.params.configId);
      if (!existing) {
        reply.code(404).send({ error: `Configuration not found: ${request.params.configId}` });
        return;
      }
      const body = (request.body ?? {}) as Record<string, unknown>;
      const record: ConfigRecord = {
        ...existing,
        properties: (body.properties as Record<string, unknown>) ?? existing.properties,
        serviceToken: typeof body.serviceToken === "string" ? body.serviceToken : existing.serviceToken,
        gzacBaseUrl: typeof body.gzacBaseUrl === "string" ? body.gzacBaseUrl : existing.gzacBaseUrl,
        eventSubscriptions: body.eventSubscriptions !== undefined
          ? normalizeSubscriptions(body.eventSubscriptions)
          : existing.eventSubscriptions,
        eventBroker: body.eventBroker !== undefined ? normalizeEventBroker(body.eventBroker) : existing.eventBroker,
        // Preserve the owner unless the update explicitly carries one.
        ownerId: typeof body.ownerId === "string" && body.ownerId ? body.ownerId : existing.ownerId,
      };
      store.set(record);
      await deps.onConfigsChanged();
      reply.code(200).send({ configurationId: record.configurationId });
    },
  );

  fastify.delete<{ Params: { configId: string } }>(
    "/api/host/configurations/:configId",
    { preHandler: hmac },
    async (request, reply) => {
      const removed = store.delete(request.params.configId);
      if (!removed) {
        reply.code(404).send({ error: `Configuration not found: ${request.params.configId}` });
        return;
      }
      await deps.onConfigsChanged();
      reply.code(204).send();
    },
  );

  // Summaries only, mirroring the plugin host: the listing exists for GZAC's reconciliation pass
  // (delete-own-orphans), so service tokens / properties / broker credentials stay server-side.
  fastify.get("/api/host/configurations", { preHandler: hmac }, async () =>
    store.list().map((record) => ({
      configurationId: record.configurationId,
      pluginId: record.pluginId,
      pluginVersion: record.pluginVersion,
      ownerId: record.ownerId,
    })),
  );

  // ---- Action invocation (HMAC) ----
  fastify.post<{ Params: { pluginId: string; version: string; actionKey: string }; Body: Record<string, unknown> }>(
    `${pluginBase}/actions/:actionKey`,
    { preHandler: hmac, config: { rawBody: true } },
    async (request, reply) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const configurationId = body.configurationId as string | undefined;
      if (!configurationId) {
        reply.code(400).send({ error: "Missing configurationId" });
        return;
      }
      const record = store.get(configurationId);
      if (!record) {
        reply.code(404).send({ error: `Configuration not found: ${configurationId}` });
        return;
      }
      try {
        const output = await runAction(
          request.params.actionKey,
          record,
          {
            processInstanceId: body.processInstanceId as string | undefined,
            documentId: body.documentId as string | undefined,
            activityId: body.activityId as string | undefined,
            properties: (body.properties as Record<string, unknown>) ?? {},
          },
          request.log,
        );
        // A plugin-level error maps to 422 so the process can catch it as a BPMN error; success is 200.
        reply.code(output.status === "error" ? 422 : 200).send(output);
      } catch (err) {
        request.log.error({ err }, "[demo-app] action failed");
        reply.code(500).send({ status: "error", errorCode: "HOST_ERROR", errorMessage: (err as Error).message });
      }
    },
  );

  // ---- Public plugin surfaces (manifest, bundles, logo, data) — CORS: * ----
  fastify.get(`${pluginBase}/plugin-manifest`, async (_request, reply) => {
    reply.header("Access-Control-Allow-Origin", "*").send(manifest);
  });

  fastify.get<{ Params: { pluginId: string; version: string; "*": string } }>(
    `${pluginBase}/bundles/*`,
    async (request, reply) => {
      const filePath = request.params["*"];
      const fullPath = resolve(PUBLIC_DIR, filePath);
      if (!fullPath.startsWith(resolve(PUBLIC_DIR))) {
        reply.code(403).header("Access-Control-Allow-Origin", "*").send({ error: "Path traversal not allowed" });
        return;
      }
      await serveFile(reply, fullPath, frameAncestorsCsp());
    },
  );

  fastify.get(`${pluginBase}/logo`, async (_request, reply) => {
    await serveFile(reply, LOGO_PATH);
  });

  // handle_request data route — public, mirroring the plugin host (this is a
  // known POC gap; a production app would gate it). CORS + OPTIONS preflight for the opaque-origin
  // iframe's cross-origin POST.
  fastify.options(`${pluginBase}/data`, async (_request, reply) => {
    reply
      .header("Access-Control-Allow-Origin", "*")
      .header("Access-Control-Allow-Methods", "POST, OPTIONS")
      .header("Access-Control-Allow-Headers", "Content-Type")
      .code(204)
      .send();
  });

  fastify.post<{ Params: { pluginId: string; version: string }; Body: Record<string, unknown> }>(
    `${pluginBase}/data`,
    async (request, reply) => {
      reply.header("Access-Control-Allow-Origin", "*");
      const body = (request.body ?? {}) as Record<string, unknown>;
      const method = body.method as string | undefined;
      const path = body.path as string | undefined;
      if (!method || !path) {
        reply.code(400).send({ error: "Missing method or path" });
        return;
      }
      const configurationId = body.configurationId as string | undefined;
      const record = configurationId ? store.get(configurationId) : store.list()[0];
      if (!record) {
        reply.code(404).send({ error: "No configuration available to serve data" });
        return;
      }
      const output = await handleRequest(
        record,
        {
          method,
          path,
          query: body.query as Record<string, string> | undefined,
          body: body.body,
          context: body.context as Record<string, unknown> | undefined,
          userToken: body.userToken as string | undefined,
        },
        request.log,
      );
      // Match the plugin host: the HTTP status is the handler's status and the HTTP body is the
      // handler's `body` (not the wrapper). GZAC's parent-proxy forwards {status, body} to the iframe.
      if (output.headers) {
        for (const [name, value] of Object.entries(output.headers)) {
          reply.header(name, value);
        }
      }
      reply.code(output.status).send(output.body ?? null);
    },
  );
}
