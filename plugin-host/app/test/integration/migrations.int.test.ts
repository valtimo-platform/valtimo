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

import {PostgreSqlContainer, type StartedPostgreSqlContainer} from "@testcontainers/postgresql";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {closeDbPool, createDbPool, type DbPool, runMigrations} from "../../src/db/index.js";
import type {HostLogger} from "../../src/models/index.js";

function noopLogger(): HostLogger {
  const l: HostLogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    child: () => l,
  };
  return l;
}

/**
 * L4 — the migration runner. Every host boot calls `runMigrations`, so "applies on an empty
 * database" and "is a no-op on an already-migrated one" are both production paths. The column-level
 * assertions pin the defaults the code depends on: `granted_capabilities` defaults to `[]` (no
 * implicit capability grant) while `granted_endpoints` stays nullable, because NULL and `[]` mean
 * different things to the gzac_api allowlist. They also double as the proof that the squashed
 * baseline in `migrations/` is equivalent to the eight incremental migrations it replaced.
 */
const BASELINE = "20260820000000000_initial-schema";

describe("runMigrations against real Postgres", () => {
  let container: StartedPostgreSqlContainer;
  let pool: DbPool;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    pool = await createDbPool(
      {
        host: container.getHost(),
        port: container.getPort(),
        database: container.getDatabase(),
        user: container.getUsername(),
        password: container.getPassword(),
      },
      noopLogger()
    );
    await runMigrations(pool, noopLogger());
  });

  afterAll(async () => {
    if (pool) await closeDbPool(pool);
    if (container) await container.stop();
  });

  async function columns(table: string): Promise<Record<string, {type: string; nullable: string; default: string | null}>> {
    const {rows} = await pool.query(
      `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns WHERE table_name = $1`,
      [table]
    );
    return Object.fromEntries(
      rows.map((r: Record<string, string>) => [
        r.column_name,
        {type: r.data_type, nullable: r.is_nullable, default: r.column_default},
      ])
    );
  }

  it("records every applied migration exactly once", async () => {
    const {rows} = await pool.query("SELECT name FROM pgmigrations ORDER BY id");
    expect(rows.map((r: {name: string}) => r.name)).toEqual([BASELINE]);
  });

  it("is idempotent — a second run on the same database changes nothing", async () => {
    // Every host boot runs migrations; a re-run must not duplicate bookkeeping or error out.
    await runMigrations(pool, noopLogger());

    const {rows} = await pool.query("SELECT name FROM pgmigrations ORDER BY id");
    expect(rows.map((r: {name: string}) => r.name)).toEqual([BASELINE]);
  });

  it("creates plugin_configurations with the capability and endpoint columns", async () => {
    const cols = await columns("plugin_configurations");

    expect(cols.configuration_id).toMatchObject({type: "text", nullable: "NO"});
    expect(cols.event_subscriptions).toMatchObject({type: "jsonb", nullable: "NO"});
    expect(cols.event_subscriptions.default).toContain("'[]'");

    // No implicit grant — an unlisted capability is denied.
    expect(cols.granted_capabilities).toMatchObject({type: "jsonb", nullable: "NO"});
    expect(cols.granted_capabilities.default).toContain("'[]'");

    // Nullable on purpose — NULL means "no allowlist pushed", [] means "deny all".
    expect(cols.granted_endpoints).toMatchObject({type: "jsonb", nullable: "YES", default: null});

    // Nullable on purpose — NULL means "unowned" (pushed by a pre-ownership GZAC); such rows are
    // excluded from every GZAC's reconciliation pass.
    expect(cols.owner_id).toMatchObject({type: "text", nullable: "YES", default: null});

    // Nullable on purpose — NULL means "no pin pushed", which skips the check.
    expect(cols.expected_content_hash).toMatchObject({
      type: "text",
      nullable: "YES",
      default: null,
    });
  });

  it("creates plugin_kv keyed by (configuration_id, key) with a prefix index", async () => {
    const cols = await columns("plugin_kv");
    expect(cols.value).toMatchObject({type: "jsonb", nullable: "NO"});

    const {rows: pk} = await pool.query(
      `SELECT a.attname FROM pg_index i
         JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = 'plugin_kv'::regclass AND i.indisprimary
        ORDER BY a.attname`
    );
    expect(pk.map((r: {attname: string}) => r.attname)).toEqual(["configuration_id", "key"]);

    const {rows: indexes} = await pool.query(
      "SELECT indexdef FROM pg_indexes WHERE tablename = 'plugin_kv'"
    );
    const definitions = indexes.map((r: {indexdef: string}) => r.indexdef).join("\n");
    expect(definitions).toContain("text_pattern_ops");
  });

  it("creates plugin_logs with both query indexes the admin log view relies on", async () => {
    const cols = await columns("plugin_logs");
    expect(cols.id.type).toBe("bigint");
    expect(cols.level).toMatchObject({nullable: "NO"});
    expect(cols.source).toMatchObject({nullable: "NO"});
    expect(cols.data).toMatchObject({type: "jsonb", nullable: "YES"});

    const {rows} = await pool.query(
      "SELECT indexname FROM pg_indexes WHERE tablename = 'plugin_logs' ORDER BY indexname"
    );
    const names = rows.map((r: {indexname: string}) => r.indexname);
    expect(names).toContain("idx_plugin_logs_config");
    expect(names).toContain("idx_plugin_logs_level");
  });

  it("applies cleanly to a second, independent database (fresh-install path)", async () => {
    // The idempotent path above starts from an already-migrated schema; this proves a cold start.
    await pool.query("CREATE DATABASE fresh_install");
    const freshPool = await createDbPool(
      {
        host: container.getHost(),
        port: container.getPort(),
        database: "fresh_install",
        user: container.getUsername(),
        password: container.getPassword(),
      },
      noopLogger()
    );
    try {
      await runMigrations(freshPool, noopLogger());
      const {rows} = await freshPool.query("SELECT name FROM pgmigrations ORDER BY id");
      expect(rows.map((r: {name: string}) => r.name)).toEqual([BASELINE]);

      const {rows: tables} = await freshPool.query(
        `SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'public' ORDER BY table_name`
      );
      expect(tables.map((r: {table_name: string}) => r.table_name)).toEqual([
        "gzac_instances",
        "pgmigrations",
        "plugin_configurations",
        "plugin_kv",
        "plugin_logs",
      ]);
    } finally {
      await closeDbPool(freshPool);
    }
  });

  it("serialises concurrent runners instead of racing them", async () => {
    // Two replicas of one host booting together both call runMigrations. The lock in `wait` mode has
    // to make one of them block and then find nothing to do — not fail, and not apply the baseline
    // twice. This is the defect the previous runner papered over with IF NOT EXISTS.
    await pool.query("CREATE DATABASE concurrent_boot");
    const dbConfig = {
      host: container.getHost(),
      port: container.getPort(),
      database: "concurrent_boot",
      user: container.getUsername(),
      password: container.getPassword(),
    };

    // Two independent pools, not two calls on one pool: advisory locks are re-entrant within a
    // session, so two calls that happened to share a connection would both "acquire" the lock and the
    // test would pass without proving anything.
    const [first, second] = await Promise.all([
      createDbPool(dbConfig, noopLogger()),
      createDbPool(dbConfig, noopLogger()),
    ]);
    try {
      await Promise.all([
        runMigrations(first, noopLogger()),
        runMigrations(second, noopLogger()),
      ]);

      const {rows} = await first.query("SELECT name FROM pgmigrations ORDER BY id");
      expect(rows.map((r: {name: string}) => r.name)).toEqual([BASELINE]);
    } finally {
      await closeDbPool(first);
      await closeDbPool(second);
    }
  });
});
