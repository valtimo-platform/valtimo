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

import {RabbitMQContainer, type StartedRabbitMQContainer} from "@testcontainers/rabbitmq";
import * as amqp from "amqplib";
import {afterAll, afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {EventConsumerManager} from "../../src/rabbitmq/event-consumer.js";
import type {EventBrokerConfig, HostLogger, PluginConfiguration} from "../../src/models/index.js";

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

describe("EventConsumerManager against real RabbitMQ", () => {
  let container: StartedRabbitMQContainer;
  let amqpUrl: string;
  const managers: EventConsumerManager[] = [];

  beforeAll(async () => {
    container = await new RabbitMQContainer("rabbitmq:3.13-management-alpine").start();
    amqpUrl = container.getAmqpUrl();
  });

  afterAll(async () => {
    if (container) await container.stop();
  });

  afterEach(async () => {
    await Promise.all(managers.splice(0).map((m) => m.close()));
  });

  function broker(exchange: string): EventBrokerConfig {
    return { amqpUrl, exchange, exchangeType: "fanout", queueMode: "live" };
  }

  function config(exchange: string, overrides: Partial<PluginConfiguration> = {}): PluginConfiguration {
    return {
      configurationId: "cfg",
      pluginId: "case-summary",
      pluginVersion: "0.1.0",
      properties: {},
      serviceToken: "svc",
      gzacBaseUrl: "http://gzac:8080",
      eventSubscriptions: ["test.type"],
      eventBroker: broker(exchange),
      ...overrides,
    };
  }

  function makeManager(hostId: string, configs: PluginConfiguration[]) {
    const callEvent = vi.fn(async () => ({ status: "completed" }));
    const configRegistry = { list: async () => configs } as never;
    const pluginManager = { callEvent } as never;
    const manager = new EventConsumerManager(pluginManager, configRegistry, hostId, noopLogger());
    managers.push(manager);
    return { manager, callEvent };
  }

  function cloudEvent(type: string) {
    return {
      id: "evt-1",
      source: "gzac",
      type,
      time: "2026-07-10T12:00:00Z",
      data: { userId: "alice", roles: ["ROLE_USER"], resultType: "document", resultId: "d1", result: { x: 1 } },
    };
  }

  async function publish(exchange: string, event: unknown): Promise<void> {
    const conn = await amqp.connect(amqpUrl);
    try {
      const ch = await conn.createConfirmChannel();
      await ch.assertExchange(exchange, "fanout", { durable: true });
      ch.publish(exchange, "", Buffer.from(JSON.stringify(event)));
      await ch.waitForConfirms();
      await ch.close();
    } finally {
      await conn.close();
    }
  }

  it("delivers a subscribed event through the broker to handle_event", async () => {
    const exchange = "evt-delivery";
    const { manager, callEvent } = makeManager("host-1", [config(exchange)]);
    await manager.sync();

    await publish(exchange, cloudEvent("test.type"));

    await vi.waitFor(() => expect(callEvent).toHaveBeenCalledTimes(1), { timeout: 15_000, interval: 200 });
    const event = callEvent.mock.calls[0][2].event;
    expect(event).toMatchObject({ type: "test.type", id: "evt-1", userId: "alice", resultId: "d1" });
  });

  it("does not deliver an event type outside the granted subscription set", async () => {
    const exchange = "evt-gate";
    const { manager, callEvent } = makeManager("host-1", [config(exchange, { eventSubscriptions: ["only.this"] })]);
    await manager.sync();

    await publish(exchange, cloudEvent("test.type")); // not granted
    // Give the broker a moment; the ungranted type must never reach the handler.
    await new Promise((r) => setTimeout(r, 1500));
    expect(callEvent).not.toHaveBeenCalled();

    // Sanity: a granted type on the same consumer still lands, proving the consumer is live.
    await publish(exchange, cloudEvent("only.this"));
    await vi.waitFor(() => expect(callEvent).toHaveBeenCalledTimes(1), { timeout: 15_000, interval: 200 });
  });

  it("load-balances across replicas that share a HOST_ID (competing consumers → once)", async () => {
    const exchange = "evt-competing";
    const a = makeManager("host-shared", [config(exchange, { configurationId: "a" })]);
    const b = makeManager("host-shared", [config(exchange, { configurationId: "b" })]);
    await a.manager.sync();
    await b.manager.sync();

    await publish(exchange, cloudEvent("test.type"));

    // Exactly one replica handles the event (they bind the same queue).
    await vi.waitFor(
      () => expect(a.callEvent.mock.calls.length + b.callEvent.mock.calls.length).toBe(1),
      { timeout: 15_000, interval: 200 }
    );
    // Hold to ensure the other replica does not also pick it up.
    await new Promise((r) => setTimeout(r, 1000));
    expect(a.callEvent.mock.calls.length + b.callEvent.mock.calls.length).toBe(1);
  });

  it("fans out to distinct hosts (each HOST_ID gets its own copy)", async () => {
    const exchange = "evt-fanout";
    const a = makeManager("host-a", [config(exchange, { configurationId: "a" })]);
    const b = makeManager("host-b", [config(exchange, { configurationId: "b" })]);
    await a.manager.sync();
    await b.manager.sync();

    await publish(exchange, cloudEvent("test.type"));

    await vi.waitFor(() => {
      expect(a.callEvent).toHaveBeenCalledTimes(1);
      expect(b.callEvent).toHaveBeenCalledTimes(1);
    }, { timeout: 15_000, interval: 200 });
  });

  it("self-heals after the broker drops the connection (reconnect + resume delivery)", async () => {
    const exchange = "evt-reconnect";
    const { manager, callEvent } = makeManager("host-recon", [config(exchange)]);
    await manager.sync();

    await publish(exchange, cloudEvent("test.type"));
    await vi.waitFor(() => expect(callEvent).toHaveBeenCalledTimes(1), { timeout: 15_000, interval: 200 });

    // Force the broker to drop every client connection — the consumer must reconnect on its own.
    await container.exec(["rabbitmqctl", "close_all_connections", "integration-test-reconnect"]);

    // After reconnect the live queue is re-created; events published during the gap are lost, so
    // re-publish on each poll until one is delivered post-reconnect.
    await vi.waitFor(
      async () => {
        await publish(exchange, cloudEvent("test.type"));
        expect(callEvent.mock.calls.length).toBeGreaterThan(1);
      },
      { timeout: 30_000, interval: 1_000 }
    );
  });
});
