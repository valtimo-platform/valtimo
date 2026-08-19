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

import pg from "pg";
import type { HostLogger } from "../models/index.js";

const { Pool } = pg;

export type DbPool = pg.Pool;

export interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export async function createDbPool(
  config: DbConfig,
  logger: HostLogger
): Promise<DbPool> {
  const pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on("error", (err) => {
    logger.error({ error: err.message }, "Unexpected database pool error");
  });

  // Verify connection
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    logger.info({ host: config.host, port: config.port, database: config.database }, "Database connected");
  } finally {
    client.release();
  }

  return pool;
}

export async function runMigrations(pool: DbPool, logger: HostLogger): Promise<void> {
  const log = logger.child({ component: "migrations" });

  // Create migrations tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const migrations = [
    {
      version: 1,
      name: "create_plugin_configurations",
      up: `
        CREATE TABLE IF NOT EXISTS plugin_configurations (
          configuration_id TEXT PRIMARY KEY,
          plugin_id TEXT NOT NULL,
          plugin_version TEXT NOT NULL,
          properties JSONB NOT NULL DEFAULT '{}',
          service_token TEXT NOT NULL,
          gzac_base_url TEXT NOT NULL,
          event_broker JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_plugin_configs_plugin ON plugin_configurations(plugin_id, plugin_version);
      `,
    },
    {
      version: 2,
      name: "add_event_subscriptions_to_plugin_configurations",
      up: `
        ALTER TABLE plugin_configurations
          ADD COLUMN IF NOT EXISTS event_subscriptions JSONB NOT NULL DEFAULT '[]';
      `,
    },
    {
      version: 3,
      name: "add_granted_capabilities_to_plugin_configurations",
      up: `
        ALTER TABLE plugin_configurations
          ADD COLUMN IF NOT EXISTS granted_capabilities JSONB NOT NULL DEFAULT '[]';
      `,
    },
    {
      version: 4,
      name: "create_plugin_kv_and_logs",
      up: `
        CREATE TABLE IF NOT EXISTS plugin_kv (
          configuration_id TEXT NOT NULL,
          key TEXT NOT NULL,
          value JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (configuration_id, key)
        );
        CREATE INDEX IF NOT EXISTS idx_plugin_kv_prefix ON plugin_kv (configuration_id, key text_pattern_ops);

        CREATE TABLE IF NOT EXISTS plugin_logs (
          id BIGSERIAL PRIMARY KEY,
          configuration_id TEXT NOT NULL,
          plugin_id TEXT NOT NULL,
          plugin_version TEXT NOT NULL,
          level VARCHAR(8) NOT NULL,
          message TEXT NOT NULL,
          data JSONB,
          source VARCHAR(32) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_plugin_logs_config ON plugin_logs (configuration_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_plugin_logs_level ON plugin_logs (configuration_id, level, created_at DESC);
      `,
    },
    {
      version: 5,
      name: "add_granted_endpoints_to_plugin_configurations",
      up: `
        -- NULL (default) means "not pushed" — older GZAC instances don't send granted endpoints,
        -- and the host then skips its side of the gzac_api allowlist check (GZAC still enforces
        -- it server-side). A pushed empty list ('[]') denies every endpoint.
        ALTER TABLE plugin_configurations
          ADD COLUMN IF NOT EXISTS granted_endpoints JSONB;
      `,
    },
    {
      version: 6,
      name: "add_allowed_egress_to_plugin_configurations",
      up: `
        -- Origins http_request may call. NOT NULL DEFAULT '[]' rather than nullable: http_request is
        -- deny-by-default, so a configuration that predates egress declarations makes no outbound
        -- calls until GZAC pushes a list. (granted_endpoints uses NULL for "not pushed" because
        -- gzac_api has an authoritative server-side allowlist to fall back on; http_request has none.)
        ALTER TABLE plugin_configurations
          ADD COLUMN IF NOT EXISTS allowed_egress JSONB NOT NULL DEFAULT '[]';
      `,
    },
    {
      version: 7,
      name: "create_gzac_instances",
      up: `
        -- One row per GZAC instance that has announced itself, keyed by the same gzacBaseUrl the
        -- configuration push uses as instance identity. frontend_origins are the browser origins
        -- that instance allows to embed this host's plugin screens; the host serves their union as
        -- the frame-ancestors CSP directive. updated_at is what makes the allowlist self-cleaning:
        -- an instance that stops announcing ages out (FRAME_ANCESTOR_STALE_MS) on its own, since
        -- there is no deregistration call.
        CREATE TABLE IF NOT EXISTS gzac_instances (
          gzac_base_url TEXT PRIMARY KEY,
          frontend_origins JSONB NOT NULL DEFAULT '[]',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `,
    },
  ];

  for (const migration of migrations) {
    const { rows } = await pool.query(
      "SELECT 1 FROM schema_migrations WHERE version = $1",
      [migration.version]
    );

    if (rows.length === 0) {
      log.info({ version: migration.version, name: migration.name }, "Running migration");
      await pool.query(migration.up);
      await pool.query("INSERT INTO schema_migrations (version) VALUES ($1)", [migration.version]);
      log.info({ version: migration.version, name: migration.name }, "Migration complete");
    }
  }
}

export async function closeDbPool(pool: DbPool): Promise<void> {
  await pool.end();
}
