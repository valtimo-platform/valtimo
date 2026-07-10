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

import type {FastifyInstance} from "fastify";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {buildTestApp, signHeaders, testConfig} from "../test-support/harness";
import {hostConfigurationRoutes} from "./host-configurations";

describe("host-configurations routes", () => {
  let app: FastifyInstance;
  let configRegistry: {
    set: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };
  let pluginManager: { getManifest: ReturnType<typeof vi.fn> };
  let eventConsumerManager: { sync: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    configRegistry = {
      set: vi.fn(async () => {}),
      get: vi.fn(async () => undefined),
      delete: vi.fn(async () => true),
      list: vi.fn(async () => []),
    };
    pluginManager = { getManifest: vi.fn(() => ({ pluginId: "case-summary", version: "0.1.0" })) };
    eventConsumerManager = { sync: vi.fn(async () => {}) };
    app = await buildTestApp((a) =>
      hostConfigurationRoutes(a, {
        configRegistry: configRegistry as never,
        pluginManager: pluginManager as never,
        config: testConfig(),
        eventConsumerManager: eventConsumerManager as never,
      })
    );
  });

  afterEach(async () => {
    await app.close();
  });

  function postConfig(configId: string, body: unknown, secret?: string) {
    const path = `/api/host/configurations/${configId}`;
    const payload = JSON.stringify(body);
    return app.inject({
      method: "POST",
      url: path,
      headers: { "content-type": "application/json", ...signHeaders("POST", path, payload, secret) },
      payload,
    });
  }

  const validBody = (overrides: Record<string, unknown> = {}) => ({
    pluginId: "case-summary",
    pluginVersion: "0.1.0",
    properties: { k: "v" },
    serviceToken: "svc-token",
    gzacBaseUrl: "http://gzac:8080",
    eventSubscriptions: ["com.ritense.valtimo.document.created"],
    eventBroker: { amqpUrl: "amqp://broker", exchange: "valtimo-events" },
    ...overrides,
  });

  describe("POST (push)", () => {
    it("stores a normalized configuration and syncs consumers", async () => {
      const res = await postConfig("cfg-1", validBody());

      expect(res.statusCode).toBe(201);
      expect(configRegistry.set).toHaveBeenCalledWith(
        "cfg-1",
        expect.objectContaining({
          configurationId: "cfg-1",
          pluginId: "case-summary",
          pluginVersion: "0.1.0",
          serviceToken: "svc-token",
          gzacBaseUrl: "http://gzac:8080",
          eventSubscriptions: ["com.ritense.valtimo.document.created"],
          // exchangeType + queueMode defaulted by normalizeEventBroker.
          eventBroker: {
            amqpUrl: "amqp://broker",
            exchange: "valtimo-events",
            exchangeType: "fanout",
            queueMode: "live",
            queueTtlMs: undefined,
          },
        })
      );
      expect(eventConsumerManager.sync).toHaveBeenCalledTimes(1);
    });

    it("drops non-string entries from eventSubscriptions", async () => {
      await postConfig("cfg-1", validBody({ eventSubscriptions: ["a", 123, "", "b"] }));
      expect(configRegistry.set.mock.calls[0][1].eventSubscriptions).toEqual(["a", "b"]);
    });

    it("disables events when the broker has no amqpUrl", async () => {
      await postConfig("cfg-1", validBody({ eventBroker: { exchange: "x" } }));
      expect(configRegistry.set.mock.calls[0][1].eventBroker).toBeUndefined();
    });

    it("clamps a durable-mode TTL below the 1h floor", async () => {
      await postConfig(
        "cfg-1",
        validBody({
          eventBroker: { amqpUrl: "amqp://broker", queueMode: "durable", queueTtlMs: 5_000 },
        })
      );
      const stored = configRegistry.set.mock.calls[0][1].eventBroker;
      expect(stored.queueMode).toBe("durable");
      expect(stored.queueTtlMs).toBe(60 * 60 * 1000);
    });

    it("returns 400 when serviceToken is missing", async () => {
      const res = await postConfig("cfg-1", validBody({ serviceToken: undefined }));
      expect(res.statusCode).toBe(400);
      expect(configRegistry.set).not.toHaveBeenCalled();
    });

    it("returns 404 when the target plugin is not loaded", async () => {
      pluginManager.getManifest.mockReturnValueOnce(null);
      const res = await postConfig("cfg-1", validBody());
      expect(res.statusCode).toBe(404);
      expect(configRegistry.set).not.toHaveBeenCalled();
    });

    it("returns 401 for a body signed with the wrong secret", async () => {
      const res = await postConfig("cfg-1", validBody(), "attacker-secret");
      expect(res.statusCode).toBe(401);
      expect(configRegistry.set).not.toHaveBeenCalled();
    });

    it("returns 401 when the signed body differs from the sent body (tamper)", async () => {
      const path = "/api/host/configurations/cfg-1";
      const signed = JSON.stringify(validBody());
      const tampered = JSON.stringify(validBody({ serviceToken: "swapped" }));
      const res = await app.inject({
        method: "POST",
        url: path,
        headers: { "content-type": "application/json", ...signHeaders("POST", path, signed) },
        payload: tampered,
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("PUT (update)", () => {
    function putConfig(configId: string, body: unknown) {
      const path = `/api/host/configurations/${configId}`;
      const payload = JSON.stringify(body);
      return app.inject({
        method: "PUT",
        url: path,
        headers: { "content-type": "application/json", ...signHeaders("PUT", path, payload) },
        payload,
      });
    }

    it("retains the stored broker + subscriptions when the update omits them", async () => {
      const existing = {
        configurationId: "cfg-1",
        pluginId: "case-summary",
        pluginVersion: "0.1.0",
        properties: {},
        serviceToken: "old-token",
        gzacBaseUrl: "http://gzac:8080",
        eventSubscriptions: ["com.ritense.valtimo.document.created"],
        eventBroker: { amqpUrl: "amqp://broker", exchange: "valtimo-events", exchangeType: "fanout" as const },
      };
      configRegistry.get.mockResolvedValueOnce(existing);

      const res = await putConfig("cfg-1", { properties: { changed: true } });

      expect(res.statusCode).toBe(200);
      expect(configRegistry.set.mock.calls[0][1]).toMatchObject({
        eventBroker: existing.eventBroker,
        eventSubscriptions: existing.eventSubscriptions,
        serviceToken: "old-token",
        properties: { changed: true },
      });
    });

    it("returns 404 when updating a configuration that does not exist", async () => {
      configRegistry.get.mockResolvedValueOnce(undefined);
      const res = await putConfig("missing", { properties: {} });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("DELETE", () => {
    function del(configId: string) {
      const path = `/api/host/configurations/${configId}`;
      return app.inject({ method: "DELETE", url: path, headers: signHeaders("DELETE", path) });
    }

    it("removes an existing configuration and syncs (204)", async () => {
      configRegistry.delete.mockResolvedValueOnce(true);
      const res = await del("cfg-1");
      expect(res.statusCode).toBe(204);
      expect(eventConsumerManager.sync).toHaveBeenCalledTimes(1);
    });

    it("returns 404 for an unknown configuration", async () => {
      configRegistry.delete.mockResolvedValueOnce(false);
      const res = await del("missing");
      expect(res.statusCode).toBe(404);
      expect(eventConsumerManager.sync).not.toHaveBeenCalled();
    });
  });

  describe("GET (list)", () => {
    it("returns the registry contents", async () => {
      configRegistry.list.mockResolvedValueOnce([{ configurationId: "cfg-1" }]);
      const path = "/api/host/configurations";
      const res = await app.inject({ method: "GET", url: path, headers: signHeaders("GET", path) });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([{ configurationId: "cfg-1" }]);
    });
  });
});
