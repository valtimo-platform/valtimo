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

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runner } from "node-pg-migrate";
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

/**
 * Directory holding the .sql migration files. Resolved from this module's own location rather than
 * cwd() so it works both from src/ under tsx and from dist/ in the image — the relative offset to
 * app/migrations/ is the same in both, since tsconfig maps src/db/ to dist/db/.
 */
const MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "migrations");

export async function runMigrations(pool: DbPool, logger: HostLogger): Promise<void> {
  const log = logger.child({ component: "migrations" });

  // A dedicated connection, not the pool: the advisory lock below is session-scoped, so lock and
  // unlock have to reach the same backend. Handing runner() the pool would route them to arbitrary
  // connections. runner() does not close a client it was given (it tracks externally supplied
  // clients as such), so releasing it here is both safe and required.
  const client = await pool.connect();
  try {
    await runner({
      dbClient: client,
      dir: MIGRATIONS_DIR,
      direction: "up",
      migrationsTable: "pgmigrations",
      // Serialise concurrent boots instead of failing them. The default ('fail') uses
      // pg_try_advisory_lock, which would crash-loop every replica that lost the race — and
      // replicas of one logical host booting together is the documented deployment shape.
      advisoryLockMode: "wait",
      // All pending migrations in one transaction: a partial upgrade never becomes visible. A future
      // migration needing CREATE INDEX CONCURRENTLY has to opt out of this.
      singleTransaction: true,
      // Refuse to run a migration whose timestamp predates one already applied — catches two
      // branches that each added a migration and merged out of order.
      checkOrder: true,
      logger: {
        info: (msg) => log.info(msg),
        warn: (msg) => log.warn(msg),
        error: (msg) => log.error(msg),
      },
    });
  } finally {
    client.release();
  }
}

export async function closeDbPool(pool: DbPool): Promise<void> {
  await pool.end();
}
