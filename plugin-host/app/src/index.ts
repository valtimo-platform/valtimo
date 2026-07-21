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

import Fastify, {type FastifyServerOptions} from "fastify";
import rawBody from "fastify-raw-body";
import multipart from "@fastify/multipart";
import {loadConfig} from "./config.js";
import {buildHttpsOptions} from "./https-options.js";
import {PluginManager} from "./plugin-manager.js";
import {ConfigRegistry} from "./config-registry.js";
import {healthRoutes} from "./routes/health.js";
import {hostManagementRoutes} from "./routes/host-management.js";
import {hostConfigurationRoutes} from "./routes/host-configurations.js";
import {pluginActionRoutes} from "./routes/plugin-actions.js";
import {pluginSubmitRoutes} from "./routes/plugin-submit.js";
import {pluginBundleRoutes} from "./routes/plugin-bundles.js";
import {pluginDataRoutes} from "./routes/plugin-data.js";
import {EventConsumerManager} from "./rabbitmq/event-consumer.js";
import {closeDbPool, createDbPool, type DbPool, runMigrations} from "./db/index.js";
import {ConfigRepository} from "./db/config-repository.js";
import {KvRepository} from "./db/kv-repository.js";
import {LogRepository} from "./db/log-repository.js";
import {pluginLogRoutes} from "./routes/plugin-logs.js";

async function main(): Promise<void> {
  const config = loadConfig();

  // When TLS is configured the host serves HTTPS, encrypting the config push (broker credentials +
  // service token) end-to-end; otherwise it serves plain HTTP and relies on a TLS-terminating proxy
  // or a loopback/localhost deployment.
  const httpsOptions = buildHttpsOptions(config);
  const fastify = Fastify({
    logger: {
      level: config.LOG_LEVEL,
    },
    ...(httpsOptions ? { https: httpsOptions } : {}),
  } as FastifyServerOptions);

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

  // Register raw body plugin for HMAC verification on action routes
  await fastify.register(rawBody, {
    field: "rawBody",
    global: false, // Only enable on routes that request it via config.rawBody
    encoding: false, // Return Buffer, not string
    runFirst: true, // Run before JSON parsing
  });

  // Register multipart for file uploads
  await fastify.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100 MB max plugin package size
    },
  });

  // Initialize repositories
  const configRepository = new ConfigRepository(dbPool);
  const kvRepository = new KvRepository(dbPool);
  const logRepository = new LogRepository(dbPool);

  // Initialize plugin manager and config registry
  const allowHttp = (process.env.HOST_ALLOW_HTTP ?? "").toLowerCase() === "true";
  // Lets http_request reach loopback/private-network targets. Local development only — in
  // production this would let a plugin use the host as a proxy into the internal network (SSRF).
  const allowPrivateNetwork = (process.env.HOST_ALLOW_PRIVATE_NETWORK ?? "").toLowerCase() === "true";
  const pluginManager = new PluginManager(
    config.PLUGIN_STORAGE_DIR,
    fastify.log,
    configRepository,
    kvRepository,
    logRepository,
    allowHttp,
    allowPrivateNetwork
  );
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
    configRegistry,
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
    config,
  });
  await fastify.register(pluginSubmitRoutes, {
    pluginManager,
    configRegistry,
    config,
  });
  await fastify.register(pluginBundleRoutes, {
    pluginManager,
  });
  await fastify.register(pluginDataRoutes, {
    pluginManager,
    configRegistry,
    config,
  });
  await fastify.register(pluginLogRoutes, {
    logRepository,
    config,
  });

  // Log retention job
  const retentionDays = parseInt(process.env.LOG_RETENTION_DAYS ?? "30", 10);
  const runRetention = async () => {
    try {
      const deleted = await logRepository.deleteOlderThan(retentionDays);
      if (deleted > 0) {
        fastify.log.info({ deleted, retentionDays }, "Log retention cleanup");
      }
    } catch (err) {
      fastify.log.warn({ error: (err as Error).message }, "Log retention failed");
    }
  };
  await runRetention();
  const retentionInterval = setInterval(runRetention, 6 * 60 * 60 * 1000);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    fastify.log.info({ signal }, "Shutting down...");
    clearInterval(retentionInterval);
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
    const scheme = httpsOptions ? "https" : "http";
    fastify.log.info(`Plugin Host listening on ${scheme}://0.0.0.0:${config.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    await closeDbPool(dbPool);
    process.exit(1);
  }
}

main();
