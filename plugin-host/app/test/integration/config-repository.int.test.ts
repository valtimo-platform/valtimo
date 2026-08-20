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
import {ConfigRegistry} from "../../src/config-registry.js";
import {ConfigRepository} from "../../src/db/config-repository.js";
import {closeDbPool, createDbPool, type DbPool, runMigrations} from "../../src/db/index.js";
import type {HostLogger, PluginConfiguration} from "../../src/models/index.js";

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

function config(overrides: Partial<PluginConfiguration> = {}): PluginConfiguration {
  return {
    configurationId: "cfg-1",
    pluginId: "case-summary",
    pluginVersion: "0.1.0",
    properties: { nested: { a: 1 }, list: [1, 2, 3] },
    serviceToken: "svc-token",
    gzacBaseUrl: "http://gzac:8080",
    eventSubscriptions: ["com.ritense.valtimo.document.created"],
    grantedCapabilities: [],
    allowedEgress: [],
    eventBroker: {
      amqpUrl: "amqp://broker",
      exchange: "valtimo-events",
      exchangeType: "fanout",
      queueMode: "durable",
      queueTtlMs: 259_200_000,
    },
    ...overrides,
  };
}

describe("ConfigRepository against real Postgres", () => {
  let container: StartedPostgreSqlContainer;
  let pool: DbPool;
  let repo: ConfigRepository;

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
    repo = new ConfigRepository(pool);
  });

  afterAll(async () => {
    if (pool) await closeDbPool(pool);
    if (container) await container.stop();
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE plugin_configurations");
  });

  it("round-trips a configuration including JSON columns", async () => {
    await repo.set("cfg-1", config());
    const got = await repo.get("cfg-1");

    expect(got).toEqual(config()); // properties, eventSubscriptions and eventBroker rehydrate from JSONB
  });

  it("round-trips the egress allowlist, and an absent one rehydrates as deny-all", async () => {
    await repo.set("cfg-1", config({
      allowedEgress: ["api.kvk.nl", "https://sd.acme-acc.internal:8443"],
    }));
    expect((await repo.get("cfg-1"))?.allowedEgress).toEqual([
      "api.kvk.nl",
      "https://sd.acme-acc.internal:8443",
    ]);

    // Unlike grantedEndpoints there is no NULL "not pushed" state to preserve: http_request is
    // deny-by-default, so an absent list and an empty list mean the same thing.
    await repo.set("cfg-2", config({ configurationId: "cfg-2", allowedEgress: undefined }));
    expect((await repo.get("cfg-2"))?.allowedEgress).toEqual([]);
  });

  it("round-trips granted capabilities and endpoints; an absent endpoint list stays absent", async () => {
    await repo.set("cfg-1", config({
      grantedCapabilities: ["gzac_api", "frontend_data"],
      grantedEndpoints: [{ method: "GET", pattern: "/api/v1/document/*" }],
    }));
    const got = await repo.get("cfg-1");
    expect(got?.grantedCapabilities).toEqual(["gzac_api", "frontend_data"]);
    expect(got?.grantedEndpoints).toEqual([{ method: "GET", pattern: "/api/v1/document/*" }]);

    // No grantedEndpoints pushed (older GZAC) → SQL NULL → undefined, NOT [] — the host relies on
    // this distinction: undefined = "no allowlist pushed, warn+allow", [] = "deny everything".
    await repo.set("cfg-2", config({ configurationId: "cfg-2" }));
    expect((await repo.get("cfg-2"))?.grantedEndpoints).toBeUndefined();

    // An empty pushed list round-trips as an empty list (deny all).
    await repo.set("cfg-3", config({ configurationId: "cfg-3", grantedEndpoints: [] }));
    expect((await repo.get("cfg-3"))?.grantedEndpoints).toEqual([]);
  });

  it("round-trips the owner and keeps an absent owner absent", async () => {
    await repo.set("cfg-1", config({ ownerId: "8a4f6f04-3f5f-4f27-9c56-6f5f0d9d2a11" }));
    expect((await repo.get("cfg-1"))?.ownerId).toBe("8a4f6f04-3f5f-4f27-9c56-6f5f0d9d2a11");

    // No owner pushed (older GZAC) → SQL NULL → undefined — excluded from reconciliation.
    await repo.set("cfg-2", config({ configurationId: "cfg-2" }));
    expect((await repo.get("cfg-2"))?.ownerId).toBeUndefined();

    // The owner column follows the push verbatim (last push wins): a re-push without an owner
    // unclaims the row, which then falls out of every GZAC's reconciliation scope.
    await repo.set("cfg-1", config());
    expect((await repo.get("cfg-1"))?.ownerId).toBeUndefined();
  });

  it("returns undefined for a missing configuration", async () => {
    expect(await repo.get("nope")).toBeUndefined();
  });

  it("upserts on conflicting configuration_id (set is idempotent by id)", async () => {
    await repo.set("cfg-1", config({ serviceToken: "first" }));
    await repo.set("cfg-1", config({ serviceToken: "second", properties: { changed: true } }));

    const got = await repo.get("cfg-1");
    expect(got?.serviceToken).toBe("second");
    expect(got?.properties).toEqual({ changed: true });
    const all = await repo.list();
    expect(all).toHaveLength(1); // upsert, not insert
  });

  it("stores a null event_broker when events are disabled", async () => {
    await repo.set("cfg-1", config({ eventBroker: undefined }));
    const got = await repo.get("cfg-1");
    // A disabled broker is SQL NULL and rehydrates as `null` (not `undefined`). The event-consumer's
    // `cfg.eventBroker?.amqpUrl` guards treat null and undefined alike, so this is harmless — but it
    // is the actual mapRow behaviour, so pin it rather than the optimistic `undefined`.
    expect(got?.eventBroker ?? null).toBeNull();
    expect(got?.eventSubscriptions).toEqual(["com.ritense.valtimo.document.created"]);
  });

  it("deletes and reports whether a row was removed", async () => {
    await repo.set("cfg-1", config());
    expect(await repo.delete("cfg-1")).toBe(true);
    expect(await repo.delete("cfg-1")).toBe(false);
    expect(await repo.get("cfg-1")).toBeUndefined();
  });

  it("lists configurations and filters by plugin id/version", async () => {
    await repo.set("a", config({ configurationId: "a", pluginId: "p1", pluginVersion: "1.0.0" }));
    await repo.set("b", config({ configurationId: "b", pluginId: "p1", pluginVersion: "2.0.0" }));
    await repo.set("c", config({ configurationId: "c", pluginId: "p2", pluginVersion: "1.0.0" }));

    expect(await repo.list()).toHaveLength(3);
    const p1v1 = await repo.listByPlugin("p1", "1.0.0");
    expect(p1v1.map((c) => c.configurationId)).toEqual(["a"]);
  });

  it("survives a simulated restart — a fresh registry reads persisted configs (boot reload)", async () => {
    await repo.set("cfg-1", config());

    // A new repository/registry over a new pool models the host restarting and rehydrating from pg.
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
      const registry = new ConfigRegistry(new ConfigRepository(freshPool));
      const all = await registry.list();
      expect(all).toHaveLength(1);
      expect(all[0].eventBroker?.amqpUrl).toBe("amqp://broker");
    } finally {
      await closeDbPool(freshPool);
    }
  });
});
