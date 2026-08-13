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
import {KvRepository} from "../../src/db/kv-repository.js";
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
 * L4 — the `kv` capability's storage (plan §18.7) against real Postgres. The JSONB round-trip, the
 * upsert-on-conflict primary key and the prefix `LIKE` escaping are all database behaviour that a
 * mocked pool would assert nothing about.
 */
describe("KvRepository against real Postgres", () => {
  let container: StartedPostgreSqlContainer;
  let pool: DbPool;
  let repo: KvRepository;

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
    repo = new KvRepository(pool);
  });

  afterAll(async () => {
    if (pool) await closeDbPool(pool);
    if (container) await container.stop();
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE plugin_kv");
  });

  describe("get / set", () => {
    it("round-trips scalars, nested objects and arrays through JSONB", async () => {
      await repo.set("cfg-1", "count", 7);
      await repo.set("cfg-1", "state", {a: [1, 2], nested: {b: "x"}});
      await repo.set("cfg-1", "list", [1, "two", null]);

      expect(await repo.get("cfg-1", "count")).toEqual({found: true, value: 7});
      expect(await repo.get("cfg-1", "state")).toEqual({
        found: true,
        value: {a: [1, 2], nested: {b: "x"}},
      });
      expect(await repo.get("cfg-1", "list")).toEqual({found: true, value: [1, "two", null]});
    });

    it("distinguishes a stored null from a missing key", async () => {
      await repo.set("cfg-1", "explicit-null", null);

      // `found` is what the host function turns into 200-with-null vs 404 (§18.7).
      expect(await repo.get("cfg-1", "explicit-null")).toEqual({found: true, value: null});
      expect(await repo.get("cfg-1", "never-written")).toEqual({found: false, value: undefined});
    });

    it("upserts on the (configuration_id, key) primary key, refreshing updated_at", async () => {
      await repo.set("cfg-1", "count", 1);
      const first = await pool.query(
        "SELECT created_at, updated_at FROM plugin_kv WHERE configuration_id = $1 AND key = $2",
        ["cfg-1", "count"]
      );

      await new Promise((resolve) => setTimeout(resolve, 20));
      await repo.set("cfg-1", "count", 2);

      const second = await pool.query(
        "SELECT created_at, updated_at FROM plugin_kv WHERE configuration_id = $1 AND key = $2",
        ["cfg-1", "count"]
      );

      expect(await repo.get("cfg-1", "count")).toEqual({found: true, value: 2});
      expect(second.rows).toHaveLength(1);
      expect(second.rows[0].created_at).toEqual(first.rows[0].created_at);
      expect(new Date(second.rows[0].updated_at).getTime()).toBeGreaterThan(
        new Date(first.rows[0].updated_at).getTime()
      );
    });

    it("stores a 256-character key (the host function's documented maximum)", async () => {
      const key = "k".repeat(256);
      await repo.set("cfg-1", key, "value");
      expect(await repo.get("cfg-1", key)).toEqual({found: true, value: "value"});
    });
  });

  describe("delete", () => {
    it("reports whether a row was removed", async () => {
      await repo.set("cfg-1", "k", 1);
      expect(await repo.delete("cfg-1", "k")).toBe(true);
      expect(await repo.delete("cfg-1", "k")).toBe(false);
      expect(await repo.get("cfg-1", "k")).toEqual({found: false, value: undefined});
    });
  });

  describe("list", () => {
    it("returns every key of the configuration, ordered", async () => {
      await repo.set("cfg-1", "b", 1);
      await repo.set("cfg-1", "a", 1);
      await repo.set("cfg-1", "c", 1);

      expect(await repo.list("cfg-1")).toEqual(["a", "b", "c"]);
    });

    it("filters by prefix", async () => {
      await repo.set("cfg-1", "user:1", 1);
      await repo.set("cfg-1", "user:2", 1);
      await repo.set("cfg-1", "session:1", 1);

      expect(await repo.list("cfg-1", "user:")).toEqual(["user:1", "user:2"]);
      expect(await repo.list("cfg-1", "nothing")).toEqual([]);
    });

    it("treats LIKE metacharacters in a prefix literally, not as wildcards", async () => {
      // Without ESCAPE handling, a prefix of "%" would list every key of the configuration and
      // "a_b" would also match "axb" — a plugin could enumerate keys it did not name.
      await repo.set("cfg-1", "100%-done", 1);
      await repo.set("cfg-1", "other", 1);
      await repo.set("cfg-1", "a_b", 1);
      await repo.set("cfg-1", "axb", 1);
      await repo.set("cfg-1", "back\\slash", 1);

      expect(await repo.list("cfg-1", "%")).toEqual([]);
      expect(await repo.list("cfg-1", "100%")).toEqual(["100%-done"]);
      expect(await repo.list("cfg-1", "a_")).toEqual(["a_b"]);
      expect(await repo.list("cfg-1", "back\\")).toEqual(["back\\slash"]);
    });
  });

  describe("scoping", () => {
    it("keeps identical keys of different configurations independent", async () => {
      await repo.set("cfg-1", "view-count", 1);
      await repo.set("cfg-2", "view-count", 99);

      expect(await repo.get("cfg-1", "view-count")).toEqual({found: true, value: 1});
      expect(await repo.get("cfg-2", "view-count")).toEqual({found: true, value: 99});
      expect(await repo.list("cfg-1")).toEqual(["view-count"]);
    });

    it("deleteAll removes only the named configuration's rows", async () => {
      await repo.set("cfg-1", "a", 1);
      await repo.set("cfg-1", "b", 1);
      await repo.set("cfg-2", "a", 1);

      await repo.deleteAll("cfg-1");

      expect(await repo.list("cfg-1")).toEqual([]);
      expect(await repo.list("cfg-2")).toEqual(["a"]);
    });
  });
});
