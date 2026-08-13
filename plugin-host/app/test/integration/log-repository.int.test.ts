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
import {afterAll, beforeAll, beforeEach, describe, expect, it} from "vitest";
import {LogRepository} from "../../src/db/log-repository.js";
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

const entry = (overrides: Record<string, unknown> = {}) => ({
  configurationId: "cfg-1",
  pluginId: "case-summary",
  pluginVersion: "0.1.0",
  level: "info",
  message: "a log line",
  data: {documentId: "doc-1"},
  source: "plugin",
  ...overrides,
});

/**
 * L4 — the storage behind the `log` capability and the admin log view (plan §18.9/§18.10) against
 * real Postgres: JSONB round-trip, the paged/filtered query the host route echoes, and the
 * retention job's cutoff arithmetic.
 */
describe("LogRepository against real Postgres", () => {
  let container: StartedPostgreSqlContainer;
  let pool: DbPool;
  let repo: LogRepository;

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
    repo = new LogRepository(pool);
  });

  afterAll(async () => {
    if (pool) await closeDbPool(pool);
    if (container) await container.stop();
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE plugin_logs");
  });

  /**
   * Inserts `count` rows and pins their timestamps one minute apart — `line 0` oldest, `line N-1`
   * newest — so newest-first ordering is asserted independently of the clock's resolution.
   */
  async function insertSpaced(count: number, overrides: Record<string, unknown> = {}) {
    for (let i = 0; i < count; i++) {
      const message = `line ${i}`;
      await repo.insert(entry({message, ...overrides}));
      await pool.query(
        "UPDATE plugin_logs SET created_at = NOW() - (INTERVAL '1 minute' * $1) WHERE message = $2",
        [count - i, message]
      );
    }
  }

  describe("insert", () => {
    it("round-trips every field, including JSONB data", async () => {
      await repo.insert(entry());

      const page = await repo.query("cfg-1", {page: 0, size: 25});
      expect(page.totalElements).toBe(1);
      expect(page.content[0]).toMatchObject({
        configurationId: "cfg-1",
        pluginId: "case-summary",
        pluginVersion: "0.1.0",
        level: "info",
        message: "a log line",
        data: {documentId: "doc-1"},
        source: "plugin",
      });
      // BIGSERIAL: `pg` hands back int8 as a string, and the contract keeps it that way.
      expect(typeof page.content[0].id).toBe("string");
      expect(page.content[0].id).toMatch(/^\d+$/);
      expect(Date.parse(page.content[0].createdAt)).not.toBeNaN();
    });

    it("stores a null data column when the entry carries no structured context", async () => {
      await repo.insert(entry({data: undefined}));
      const page = await repo.query("cfg-1", {page: 0, size: 25});
      expect(page.content[0].data).toBeNull();
    });

    it.each([
      ["false", false],
      ["zero", 0],
      ["an empty string", ""],
    ] as const)("round-trips %s rather than collapsing it to null", async (_label, data) => {
      await repo.insert(entry({data}));
      const page = await repo.query("cfg-1", {page: 0, size: 25});
      expect(page.content[0].data).toBe(data);
    });

    it("truncates an over-long message to 4096 characters", async () => {
      await repo.insert(entry({message: "x".repeat(5000)}));
      const page = await repo.query("cfg-1", {page: 0, size: 25});
      expect(page.content[0].message).toHaveLength(4096);
    });
  });

  describe("query", () => {
    it("pages newest-first and reports the full filtered total", async () => {
      await insertSpaced(5);

      const first = await repo.query("cfg-1", {page: 0, size: 2});
      expect(first.totalElements).toBe(5);
      expect(first.page).toBe(0);
      expect(first.size).toBe(2);
      expect(first.content).toHaveLength(2);
      expect(first.content[0].message).toBe("line 4"); // newest
      expect(first.content[1].message).toBe("line 3");

      const second = await repo.query("cfg-1", {page: 1, size: 2});
      expect(second.content.map((r) => r.message)).toEqual(["line 2", "line 1"]);
    });

    it("returns an empty page past the end while still reporting the total", async () => {
      await insertSpaced(3);
      const page = await repo.query("cfg-1", {page: 10, size: 25});
      expect(page.content).toEqual([]);
      expect(page.totalElements).toBe(3);
    });

    it("clamps the page size into 1..100", async () => {
      await insertSpaced(3);
      expect((await repo.query("cfg-1", {page: 0, size: 0})).size).toBe(25); // 0 → default
      expect((await repo.query("cfg-1", {page: 0, size: 5_000})).size).toBe(100);
    });

    it("normalizes a negative page to the first page, in the offset and in the response", async () => {
      await insertSpaced(3);
      const page = await repo.query("cfg-1", {page: -3, size: 2});

      expect(page.content).toHaveLength(2); // no negative offset
      // The reported index has to match the content, or a caller paging forward from it skips rows.
      expect(page.page).toBe(0);
      expect(page.content.map((r) => r.message)).toEqual(["line 2", "line 1"]);
    });

    it("filters by level, by source, and by both", async () => {
      await repo.insert(entry({level: "info", source: "plugin", message: "i-p"}));
      await repo.insert(entry({level: "error", source: "plugin", message: "e-p"}));
      await repo.insert(entry({level: "info", source: "http_request", message: "i-h"}));
      await repo.insert(entry({level: "error", source: "http_request", message: "e-h"}));

      const errors = await repo.query("cfg-1", {page: 0, size: 25, level: "error"});
      expect(errors.totalElements).toBe(2);
      expect(errors.content.map((r) => r.message).sort()).toEqual(["e-h", "e-p"]);

      const apiCalls = await repo.query("cfg-1", {page: 0, size: 25, source: "http_request"});
      expect(apiCalls.content.map((r) => r.message).sort()).toEqual(["e-h", "i-h"]);

      const both = await repo.query("cfg-1", {page: 0, size: 25, level: "error", source: "http_request"});
      expect(both.totalElements).toBe(1);
      expect(both.content[0].message).toBe("e-h");
    });

    it("never returns another configuration's rows", async () => {
      await repo.insert(entry({configurationId: "cfg-1", message: "mine"}));
      await repo.insert(entry({configurationId: "cfg-2", message: "theirs"}));

      const page = await repo.query("cfg-1", {page: 0, size: 25});
      expect(page.totalElements).toBe(1);
      expect(page.content[0].message).toBe("mine");
    });
  });

  describe("retention", () => {
    it("deletes only rows older than the cutoff and returns the count", async () => {
      await repo.insert(entry({message: "fresh"}));
      await repo.insert(entry({message: "stale"}));
      await pool.query(
        "UPDATE plugin_logs SET created_at = NOW() - INTERVAL '31 days' WHERE message = 'stale'"
      );

      expect(await repo.deleteOlderThan(30)).toBe(1);

      const page = await repo.query("cfg-1", {page: 0, size: 25});
      expect(page.content.map((r) => r.message)).toEqual(["fresh"]);
    });

    it("deletes nothing when every row is inside the retention window", async () => {
      await repo.insert(entry());
      expect(await repo.deleteOlderThan(30)).toBe(0);
    });

    it("spans configurations — retention is host-wide, not per configuration", async () => {
      await repo.insert(entry({configurationId: "cfg-1"}));
      await repo.insert(entry({configurationId: "cfg-2"}));
      await pool.query("UPDATE plugin_logs SET created_at = NOW() - INTERVAL '31 days'");

      expect(await repo.deleteOlderThan(30)).toBe(2);
    });

    it("deleteByConfiguration removes only that configuration's rows", async () => {
      await repo.insert(entry({configurationId: "cfg-1"}));
      await repo.insert(entry({configurationId: "cfg-2"}));

      await repo.deleteByConfiguration("cfg-1");

      expect((await repo.query("cfg-1", {page: 0, size: 25})).totalElements).toBe(0);
      expect((await repo.query("cfg-2", {page: 0, size: 25})).totalElements).toBe(1);
    });
  });
});
