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

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {HostLogger, PluginConfiguration} from "../models/index.js";
import {EventConsumerManager} from "./event-consumer";

// Shared capture points for the amqplib mock: every channel's consume() callback (tagged with its
// queue name) and the channel objects, so a test can drive a message into a specific broker's
// consumer and inspect the queue declaration.
const h = vi.hoisted(() => ({
  consumers: [] as Array<{ queue: string; cb: (msg: unknown) => unknown; channel: MockChannel }>,
  channels: [] as MockChannel[],
}));

interface MockChannel {
  prefetch: ReturnType<typeof vi.fn>;
  assertExchange: ReturnType<typeof vi.fn>;
  assertQueue: ReturnType<typeof vi.fn>;
  bindQueue: ReturnType<typeof vi.fn>;
  consume: ReturnType<typeof vi.fn>;
  ack: ReturnType<typeof vi.fn>;
  nack: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

vi.mock("amqplib", () => {
  const makeChannel = (): MockChannel => {
    const channel: MockChannel = {
      prefetch: vi.fn(async () => {}),
      assertExchange: vi.fn(async () => {}),
      assertQueue: vi.fn(async (q: string) => ({ queue: q })),
      bindQueue: vi.fn(async () => {}),
      consume: vi.fn(async (q: string, cb: (msg: unknown) => unknown) => {
        h.consumers.push({ queue: q, cb, channel });
        return { consumerTag: "tag" };
      }),
      ack: vi.fn(),
      nack: vi.fn(),
      close: vi.fn(async () => {}),
    };
    h.channels.push(channel);
    return channel;
  };
  const makeConnection = () => ({
    on: vi.fn(),
    createChannel: vi.fn(async () => makeChannel()),
    close: vi.fn(async () => {}),
  });
  const connect = vi.fn(async () => makeConnection());
  return { connect, default: { connect } };
});

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

const BROKER_1 = {
  amqpUrl: "amqp://broker-1",
  exchange: "valtimo-events",
  exchangeType: "fanout" as const,
  queueMode: "live" as const,
};
const BROKER_2 = {
  amqpUrl: "amqp://broker-2",
  exchange: "other-exchange",
  exchangeType: "fanout" as const,
  queueMode: "live" as const,
};

function config(overrides: Partial<PluginConfiguration> = {}): PluginConfiguration {
  return {
    configurationId: "cfg-A",
    pluginId: "case-summary",
    pluginVersion: "0.1.0",
    properties: { setting: "x" },
    serviceToken: "svc-token",
    gzacBaseUrl: "http://gzac:8080",
    eventSubscriptions: ["com.ritense.valtimo.document.created"],
    eventBroker: BROKER_1,
    ...overrides,
  };
}

function cloudEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt-1",
    source: "gzac",
    type: "com.ritense.valtimo.document.created",
    time: "2026-07-10T12:00:00Z",
    data: {
      userId: "alice",
      roles: ["ROLE_USER"],
      resultType: "document",
      resultId: "doc-99",
      result: { foo: "bar" },
    },
    ...overrides,
  };
}

function message(event: unknown) {
  return { content: Buffer.from(JSON.stringify(event), "utf-8") };
}

function consumerFor(exchange: string) {
  const c = h.consumers.find((x) => x.queue.includes(exchange));
  if (!c) throw new Error(`no consumer for exchange ${exchange}; queues: ${h.consumers.map((x) => x.queue)}`);
  return c;
}

describe("EventConsumerManager", () => {
  let pluginManager: { callEvent: ReturnType<typeof vi.fn> };
  let configRegistry: { list: ReturnType<typeof vi.fn> };
  let manager: EventConsumerManager;

  function build(configs: PluginConfiguration[]) {
    pluginManager = { callEvent: vi.fn(async () => ({ status: "completed" })) };
    configRegistry = { list: vi.fn(async () => configs) };
    manager = new EventConsumerManager(
      pluginManager as never,
      configRegistry as never,
      "host-1",
      noopLogger()
    );
  }

  beforeEach(() => {
    h.consumers.length = 0;
    h.channels.length = 0;
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await manager?.close();
  });

  describe("dispatch grant gate", () => {
    it("invokes handle_event for a config whose granted subscriptions include the event type", async () => {
      build([config()]);
      await manager.sync();

      await consumerFor("valtimo-events").cb(message(cloudEvent()));

      expect(pluginManager.callEvent).toHaveBeenCalledTimes(1);
      expect(pluginManager.callEvent).toHaveBeenCalledWith(
        "case-summary",
        "0.1.0",
        expect.objectContaining({
          configurationId: "cfg-A",
          configuration: { setting: "x" },
          serviceToken: "svc-token",
          gzacBaseUrl: "http://gzac:8080",
        })
      );
    });

    it("does NOT deliver an event type absent from the granted subscription set", async () => {
      // The type is NOT in eventSubscriptions even though a plugin manifest might declare it.
      build([config({ eventSubscriptions: ["com.ritense.valtimo.task.completed"] })]);
      await manager.sync();

      await consumerFor("valtimo-events").cb(message(cloudEvent()));

      expect(pluginManager.callEvent).not.toHaveBeenCalled();
    });

    it("does NOT deliver to a config on a different broker than the consuming connection", async () => {
      const onBroker1 = config({ configurationId: "on-1", eventBroker: BROKER_1 });
      const onBroker2 = config({ configurationId: "on-2", eventBroker: BROKER_2 });
      build([onBroker1, onBroker2]);
      await manager.sync();

      // Feed the event through broker-1's consumer only.
      await consumerFor("valtimo-events").cb(message(cloudEvent()));

      expect(pluginManager.callEvent).toHaveBeenCalledTimes(1);
      expect(pluginManager.callEvent).toHaveBeenCalledWith(
        "case-summary",
        "0.1.0",
        expect.objectContaining({ configurationId: "on-1" })
      );
    });
  });

  describe("event flattening", () => {
    it("flattens the CloudEvent envelope + data into the EventInput the plugin receives", async () => {
      build([config()]);
      await manager.sync();

      await consumerFor("valtimo-events").cb(message(cloudEvent()));

      const event = pluginManager.callEvent.mock.calls[0][2].event;
      expect(event).toEqual({
        type: "com.ritense.valtimo.document.created",
        id: "evt-1",
        source: "gzac",
        time: "2026-07-10T12:00:00Z",
        userId: "alice",
        roles: ["ROLE_USER"],
        resultType: "document",
        resultId: "doc-99",
        result: { foo: "bar" },
      });
    });

    it("ignores a CloudEvent with no type (acks without dispatching)", async () => {
      build([config()]);
      await manager.sync();

      const consumer = consumerFor("valtimo-events");
      await consumer.cb(message(cloudEvent({ type: undefined })));

      expect(pluginManager.callEvent).not.toHaveBeenCalled();
      expect(consumer.channel.ack).toHaveBeenCalledTimes(1);
      expect(consumer.channel.nack).not.toHaveBeenCalled();
    });
  });

  describe("message acknowledgement", () => {
    it("acks a successfully processed message", async () => {
      build([config()]);
      await manager.sync();

      const consumer = consumerFor("valtimo-events");
      await consumer.cb(message(cloudEvent()));

      expect(consumer.channel.ack).toHaveBeenCalledTimes(1);
      expect(consumer.channel.nack).not.toHaveBeenCalled();
    });

    it("still acks when a handle_event invocation throws (one failure doesn't poison the loop)", async () => {
      build([config()]);
      await manager.sync();
      pluginManager.callEvent.mockRejectedValueOnce(new Error("plugin blew up"));

      const consumer = consumerFor("valtimo-events");
      await consumer.cb(message(cloudEvent()));

      expect(pluginManager.callEvent).toHaveBeenCalledTimes(1);
      expect(consumer.channel.ack).toHaveBeenCalledTimes(1);
      expect(consumer.channel.nack).not.toHaveBeenCalled();
    });

    it("nack-drops a malformed message without requeue", async () => {
      build([config()]);
      await manager.sync();

      const consumer = consumerFor("valtimo-events");
      await consumer.cb({ content: Buffer.from("{not-json", "utf-8") });

      expect(consumer.channel.ack).not.toHaveBeenCalled();
      expect(consumer.channel.nack).toHaveBeenCalledWith(expect.anything(), false, false);
    });
  });

  describe("queue declaration", () => {
    it("declares a live-mode queue as non-durable + auto-delete with a .live suffix", async () => {
      build([config({ eventBroker: BROKER_1 })]);
      await manager.sync();

      const assertQueue = consumerFor("valtimo-events").channel.assertQueue;
      expect(assertQueue).toHaveBeenCalledWith(
        "valtimo-external-plugins.valtimo-events.host-1.live",
        { durable: false, autoDelete: true }
      );
    });

    it("declares a durable-mode queue with x-expires and a .durable suffix", async () => {
      build([
        config({
          eventBroker: {
            ...BROKER_1,
            queueMode: "durable",
            queueTtlMs: 259_200_000,
          },
        }),
      ]);
      await manager.sync();

      const assertQueue = consumerFor("valtimo-events").channel.assertQueue;
      expect(assertQueue).toHaveBeenCalledWith(
        "valtimo-external-plugins.valtimo-events.host-1.durable",
        { durable: true, autoDelete: false, arguments: { "x-expires": 259_200_000 } }
      );
    });
  });

  describe("broker reconciliation", () => {
    it("opens exactly one consumer per distinct broker", async () => {
      build([
        config({ configurationId: "a", eventBroker: BROKER_1 }),
        config({ configurationId: "b", eventBroker: BROKER_1 }), // same broker → shared consumer
        config({ configurationId: "c", eventBroker: BROKER_2 }),
      ]);
      await manager.sync();

      expect(h.consumers).toHaveLength(2);
    });

    it("opens no consumer for a config without a broker (actions-only)", async () => {
      build([config({ eventBroker: undefined })]);
      await manager.sync();

      expect(h.consumers).toHaveLength(0);
    });
  });
});
