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

import * as amqp from "amqplib";
import type { FastifyBaseLogger } from "fastify";
import { handleEvent } from "./plugin.js";
import type { ConfigStore, EventBrokerConfig } from "./store.js";

/**
 * Compact event consumer, mirroring the plugin host's design: one AMQP connection per distinct
 * broker learned from the pushed configurations, a per-app queue bound to GZAC's fanout exchange,
 * and dispatch gated by each configuration's granted `eventSubscriptions`. GZAC's outbox is
 * at-least-once, so handlers must be idempotent.
 */

interface CloudEventJson {
  id?: string;
  source?: string;
  type?: string;
  time?: string;
  data?: { userId?: string; roles?: string[]; resultType?: string; resultId?: string; result?: unknown };
}

function brokerKey(b: EventBrokerConfig): string {
  return `${b.amqpUrl} ${b.exchange} ${b.exchangeType}`;
}

function queueName(b: EventBrokerConfig, hostId: string): string {
  return `valtimo-external-apps.${b.exchange}.${hostId}.${b.queueMode}`;
}

// Fixed reconnect delay. The plugin host uses exponential backoff with jitter; a flat delay keeps
// the reference app simple while still recovering from a broker restart.
const RECONNECT_DELAY_MS = 5_000;

class BrokerConsumer {
  private connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;
  private channel: amqp.Channel | null = null;
  private intentionalClose = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly broker: EventBrokerConfig,
    private readonly hostId: string,
    private readonly onEvent: (key: string, event: CloudEventJson) => Promise<void>,
    private readonly log: FastifyBaseLogger,
  ) {}

  async start(): Promise<void> {
    await this.open();
  }

  async close(): Promise<void> {
    this.intentionalClose = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      // ignore
    } finally {
      this.channel = null;
      this.connection = null;
    }
  }

  private async open(): Promise<void> {
    const connection = await amqp.connect(this.broker.amqpUrl);
    connection.on("error", (err: Error) => this.log.warn({ error: err.message }, "[demo-app] broker connection error"));
    connection.on("close", () => {
      this.connection = null;
      this.channel = null;
      if (this.intentionalClose) return;
      this.log.warn("[demo-app] broker connection closed; scheduling reconnect");
      this.scheduleReconnect();
    });

    const channel = await connection.createChannel();
    await channel.prefetch(16);
    await channel.assertExchange(this.broker.exchange, this.broker.exchangeType, { durable: true });
    const queue = queueName(this.broker, this.hostId);
    const q =
      this.broker.queueMode === "durable"
        ? await channel.assertQueue(queue, { durable: true, autoDelete: false, arguments: { "x-expires": this.broker.queueTtlMs } })
        : await channel.assertQueue(queue, { durable: false, autoDelete: true });
    await channel.bindQueue(q.queue, this.broker.exchange, "");
    await channel.consume(q.queue, (msg) => void this.onMessage(msg), { noAck: false });

    this.connection = connection;
    this.channel = channel;
    this.log.info({ exchange: this.broker.exchange, queue: q.queue, mode: this.broker.queueMode }, "[demo-app] broker consumer started");
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open().catch(() => this.scheduleReconnect());
    }, RECONNECT_DELAY_MS);
  }

  private async onMessage(msg: amqp.ConsumeMessage | null): Promise<void> {
    if (!msg) return;
    try {
      const event = JSON.parse(msg.content.toString("utf-8")) as CloudEventJson;
      await this.onEvent(brokerKey(this.broker), event);
      this.channel?.ack(msg);
    } catch (err) {
      this.log.warn({ error: (err as Error).message }, "[demo-app] failed to process event; dropping");
      this.channel?.nack(msg, false, false);
    }
  }
}

export class EventConsumerManager {
  private readonly consumers = new Map<string, BrokerConsumer>();
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private readonly store: ConfigStore,
    private readonly hostId: string,
    private readonly log: FastifyBaseLogger,
  ) {}

  /** Reconcile consumers with the brokers referenced by the current configurations. Serialized. */
  sync(): Promise<void> {
    this.chain = this.chain
      .then(() => this.reconcile())
      .catch((err) => this.log.error({ error: (err as Error).message }, "[demo-app] event sync failed"));
    return this.chain;
  }

  async close(): Promise<void> {
    await Promise.all([...this.consumers.values()].map((c) => c.close()));
    this.consumers.clear();
  }

  private async reconcile(): Promise<void> {
    const desired = new Map<string, EventBrokerConfig>();
    for (const cfg of this.store.list()) {
      if (cfg.eventBroker?.amqpUrl) desired.set(brokerKey(cfg.eventBroker), cfg.eventBroker);
    }
    for (const [key, broker] of desired) {
      if (this.consumers.has(key)) continue;
      const consumer = new BrokerConsumer(broker, this.hostId, (k, e) => this.dispatch(k, e), this.log);
      try {
        await consumer.start();
        this.consumers.set(key, consumer);
      } catch (err) {
        this.log.error({ error: (err as Error).message }, "[demo-app] failed to start broker consumer");
      }
    }
    for (const [key, consumer] of this.consumers) {
      if (desired.has(key)) continue;
      await consumer.close();
      this.consumers.delete(key);
    }
  }

  private async dispatch(key: string, cloudEvent: CloudEventJson): Promise<void> {
    const type = cloudEvent.type;
    if (!type) return;
    const data = cloudEvent.data ?? {};
    const event = { type, id: cloudEvent.id ?? "", source: cloudEvent.source ?? "", time: cloudEvent.time, ...data };
    for (const cfg of this.store.list()) {
      if (!cfg.eventBroker || brokerKey(cfg.eventBroker) !== key) continue;
      // Authoritative gate: only the granted subscription set, never the manifest's declaration.
      if (!cfg.eventSubscriptions.includes(type)) continue;
      await handleEvent(cfg, event, this.log).catch((err) =>
        this.log.warn({ error: (err as Error).message, type }, "[demo-app] handle_event failed"),
      );
    }
  }
}
