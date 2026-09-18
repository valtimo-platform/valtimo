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

/**
 * Standalone migration entry point: applies pending migrations and exits. Same image and same
 * migration files as the app, so there is no second artifact to version — only a different command:
 *
 *   docker run --rm <image> node dist/migrate.js
 *
 * Intended for a Kubernetes initContainer or pre-deploy Job, paired with DB_MIGRATE_ON_BOOT=false.
 * Reads the same DB_* variables as the app (minus ADMIN_TOKEN, which a migration never needs) rather
 * than the DATABASE_URL/PGHOST pair node-pg-migrate's own CLI insists on, so a deployment carries one
 * copy of the credentials instead of two differently-shaped ones.
 *
 * Run migrations over a direct Postgres connection, not through PgBouncer in transaction or
 * statement pooling mode: the advisory lock that serialises concurrent runners is session-scoped and
 * such a pooler will not keep it on one backend.
 */
import pino from "pino";
import { loadMigrateConfig } from "./config.js";
import { closeDbPool, createDbPool, runMigrations } from "./db/index.js";

async function main(): Promise<void> {
  const config = loadMigrateConfig();
  const logger = pino({ level: config.LOG_LEVEL });

  const pool = await createDbPool(
    {
      host: config.DB_HOST,
      port: config.DB_PORT,
      database: config.DB_NAME,
      user: config.DB_USER,
      password: config.DB_PASSWORD,
    },
    logger
  );
  try {
    await runMigrations(pool, logger);
    logger.info("Migrations up to date");
  } finally {
    await closeDbPool(pool);
  }
}

main().catch((err) => {
  // Non-zero exit is the contract with the deploy job: a failed migration must fail the deploy
  // loudly rather than let the app roll out against a stale schema.
  console.error(err);
  process.exit(1);
});
