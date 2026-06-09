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
import multipart from "@fastify/multipart";
import { loadConfig } from "./config.js";
import { PluginManager } from "./plugin-manager.js";
import { ConfigRegistry } from "./config-registry.js";
import { healthRoutes } from "./routes/health.js";
import { hostManagementRoutes } from "./routes/host-management.js";
import { hostConfigurationRoutes } from "./routes/host-configurations.js";
import { pluginActionRoutes } from "./routes/plugin-actions.js";
import { pluginBundleRoutes } from "./routes/plugin-bundles.js";
import { EventConsumerManager } from "./rabbitmq/event-consumer.js";
import { createDbPool, runMigrations, closeDbPool, type DbPool } from "./db/index.js";
import { ConfigRepository } from "./db/config-repository.js";

async function main(): Promise<void> {
  const config = loadConfig();

  const fastify = Fastify({
    logger: {
      level: config.LOG_LEVEL,
    },
  });

  // Initialize database connection
  let dbPool: DbPool;
  try {
    dbPool = await createDbPool(
      {
        host: config.DB_HOST,
        port: config.DB_PORT,
        database: config.DB_NAME,
        user: config.DB_USER,
        password: config.DB_PASSWORD,
      },
      fastify.log
    );
    await runMigrations(dbPool, fastify.log);
  } catch (err) {
    fastify.log.error({ error: (err as Error).message }, "Failed to connect to database");
    process.exit(1);
  }

  // Register multipart for file uploads
  await fastify.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100 MB max plugin package size
    },
  });

  // Initialize plugin manager and config registry
  const pluginManager = new PluginManager(
    config.PLUGIN_STORAGE_DIR,
    fastify.log
  );
  const configRepository = new ConfigRepository(dbPool);
  const configRegistry = new ConfigRegistry(configRepository);

  // Brokers are learned from the configurations GZAC pushes; the manager opens/closes consumers as
  // configurations come and go (see hostConfigurationRoutes).
  const eventConsumerManager = new EventConsumerManager(
    pluginManager,
    configRegistry,
    config.HOST_ID,
    fastify.log
  );

  // Load existing plugins from disk
  await pluginManager.loadAllFromDisk();

  // Sync event consumers with persisted configurations
  await eventConsumerManager.sync();

  // Register routes
  await fastify.register(healthRoutes);
  await fastify.register(hostManagementRoutes, {
    pluginManager,
    config,
  });
  await fastify.register(hostConfigurationRoutes, {
    configRegistry,
    pluginManager,
    config,
    eventConsumerManager,
  });
  await fastify.register(pluginActionRoutes, {
    pluginManager,
    configRegistry,
  });
  await fastify.register(pluginBundleRoutes, {
    pluginManager,
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    fastify.log.info({ signal }, "Shutting down...");
    await eventConsumerManager.close();
    await closeDbPool(dbPool);
    await fastify.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Start server
  try {
    await fastify.listen({ port: config.PORT, host: "0.0.0.0" });
    fastify.log.info(`Plugin Host listening on port ${config.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    await closeDbPool(dbPool);
    process.exit(1);
  }
}

main();
