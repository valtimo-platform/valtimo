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
import {closeDbPool, createDbPool, type DbPool, runMigrations} from "../../src/db/index.js";
import {GzacInstanceRepository} from "../../src/db/gzac-instance-repository.js";
import {FrameAncestorRegistry} from "../../src/frame-ancestor-registry.js";
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
 * L4 — the frame-ancestor allowlist against a real database. The staleness window is expressed in
 * SQL (`updated_at > NOW() - interval`), and persistence is the whole point of storing this at all:
 * a host that forgot its allowlist on restart would serve `frame-ancestors 'none'` — every plugin
 * screen blank — until the next discovery poll.
 */
describe("GzacInstanceRepository against real Postgres", () => {
  let container: StartedPostgreSqlContainer;
  let pool: DbPool;
  let repo: GzacInstanceRepository;

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
    repo = new GzacInstanceRepository(pool);
  });

  afterAll(async () => {
    if (pool) await closeDbPool(pool);
    if (container) await container.stop();
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE gzac_instances");
  });

  it("round-trips an instance and its origins", async () => {
    await repo.upsert("http://gzac:8080", ["https://valtimo.example.com", "http://localhost:4200"]);

    expect(await repo.listFresh(60_000)).toEqual([
      {
        gzacBaseUrl: "http://gzac:8080",
        frontendOrigins: ["https://valtimo.example.com", "http://localhost:4200"],
      },
    ]);
  });

  it("upserts on the GZAC base URL — re-announcing every poll must not accumulate rows", async () => {
    await repo.upsert("http://gzac:8080", ["https://old.example.com"]);
    await repo.upsert("http://gzac:8080", ["https://new.example.com"]);

    const instances = await repo.listFresh(60_000);
    expect(instances).toHaveLength(1);
    expect(instances[0].frontendOrigins).toEqual(["https://new.example.com"]);
  });

  it("keeps multiple GZAC instances side by side", async () => {
    await repo.upsert("http://gzac-a:8080", ["https://a.example.com"]);
    await repo.upsert("http://gzac-b:8080", ["https://b.example.com"]);

    expect((await repo.listFresh(60_000)).map((i) => i.gzacBaseUrl)).toEqual([
      "http://gzac-a:8080",
      "http://gzac-b:8080",
    ]);
  });

  it("excludes an instance that has not re-announced within the staleness window", async () => {
    await repo.upsert("http://gzac-old:8080", ["https://old.example.com"]);
    await pool.query(
      "UPDATE gzac_instances SET updated_at = NOW() - INTERVAL '2 days' WHERE gzac_base_url = $1",
      ["http://gzac-old:8080"]
    );
    await repo.upsert("http://gzac:8080", ["https://valtimo.example.com"]);

    expect((await repo.listFresh(24 * 60 * 60 * 1000)).map((i) => i.gzacBaseUrl)).toEqual([
      "http://gzac:8080",
    ]);
    // A wide enough window brings the old instance back — nothing was deleted, only filtered.
    expect(await repo.listFresh(7 * 24 * 60 * 60 * 1000)).toHaveLength(2);
  });

  it("survives a restart — a fresh registry serves the persisted origins", async () => {
    await repo.upsert("http://gzac:8080", ["https://valtimo.example.com"]);

    const freshPool = await createDbPool(
      {
        host: container.getHost(),
        port: container.getPort(),
        database: container.getDatabase(),
        user: container.getUsername(),
        password: container.getPassword(),
      },
      noopLogger()
    );
    try {
      const registry = new FrameAncestorRegistry(new GzacInstanceRepository(freshPool));
      expect(await registry.allowedOrigins()).toEqual(["https://valtimo.example.com"]);
      expect(await registry.isAllowed("https://valtimo.example.com")).toBe(true);
      expect(await registry.isAllowed("https://evil.example")).toBe(false);
    } finally {
      await closeDbPool(freshPool);
    }
  });
});
