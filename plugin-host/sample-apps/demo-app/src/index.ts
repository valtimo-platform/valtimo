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

import Fastify from "fastify";
import rawBody from "fastify-raw-body";
import { loadConfig } from "./config.js";
import { EventConsumerManager } from "./events.js";
import { registerRoutes } from "./routes.js";
import { ConfigStore } from "./store.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const fastify = Fastify({ logger: { level: config.LOG_LEVEL } });

  // Raw-body capture, enabled per route via `config: { rawBody: true }`, so the HMAC hook can bind
  // the exact request bytes on the action and config-push routes.
  await fastify.register(rawBody, { field: "rawBody", global: false, encoding: false, runFirst: true });

  const store = new ConfigStore();
  const eventConsumer = new EventConsumerManager(store, config.HOST_ID, fastify.log);

  await registerRoutes(fastify, {
    config,
    store,
    onConfigsChanged: () => eventConsumer.sync(),
  });

  const shutdown = async (signal: string) => {
    fastify.log.info({ signal }, "[demo-app] shutting down");
    await eventConsumer.close();
    await fastify.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  try {
    await fastify.listen({ port: config.PORT, host: "0.0.0.0" });
    fastify.log.info(`[demo-app] listening on http://0.0.0.0:${config.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

void main();
