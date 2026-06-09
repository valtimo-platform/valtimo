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
import type { EventBrokerConfig, HostLogger } from "../models/index.js";
import type { PluginManager } from "../plugin-manager.js";
import type { ConfigRegistry } from "../config-registry.js";

/**
 * CloudEvent (v1, JSON format) as published by a GZAC instance's outbox. Only the fields the host
 * forwards to plugins are modelled; the embedded `data` is the outbox `CloudEventData` payload.
 */
interface CloudEventJson {
  id?: string;
  source?: string;
  type?: string;
  time?: string;
  data?: {
    userId?: string;
    roles?: string[];
    resultType?: string;
    resultId?: string;
    result?: unknown;
  };
}

/** Stable identity of a broker connection — connections are shared across configs that match it. */
function brokerKey(b: EventBrokerConfig): string {
  return `${b.amqpUrl} ${b.exchange} ${b.exchangeType}`;
}

/**
 * Per-host queue name. On a fanout exchange every distinct host binds its OWN queue and so receives
 * its own copy of each event; replicas sharing a `hostId` bind the same queue and load-balance. The
 * exchange is included so distinct exchanges on one broker don't collide.
 */
function queueName(b: EventBrokerConfig, hostId: string): string {
  return `valtimo-external-plugins.${b.exchange}.${hostId}`;
}

type Router = (key: string, event: CloudEventJson) => Promise<void>;

/**
 * A single AMQP connection to one GZAC instance's broker. Binds this host's own queue to that
 * instance's events exchange and forwards every consumed CloudEvent to the manager's router, tagged
 * with the broker key so the manager can route it only to that instance's configurations.
 */
class BrokerConsumer {
  private connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;
  private channel: amqp.Channel | null = null;
  private intentionalClose = false;

  constructor(
    private readonly key: string,
    private readonly broker: EventBrokerConfig,
    private readonly hostId: string,
    private readonly route: Router,
    private readonly onClosed: (key: string) => void,
    private readonly log: HostLogger
  ) {}

  async start(): Promise<void> {
    this.connection = await amqp.connect(this.broker.amqpUrl);
    // A dropped connection leaves a dead consumer; let the manager drop it so the next config
    // sync recreates it. (No standalone reconnect loop — config pushes drive re-sync.)
    this.connection.on("close", () => {
      if (!this.intentionalClose) {
        this.log.warn({ exchange: this.broker.exchange }, "Broker connection closed");
        this.onClosed(this.key);
      }
    });
    this.connection.on("error", (err: Error) => {
      this.log.warn({ exchange: this.broker.exchange, error: err.message }, "Broker connection error");
    });

    this.channel = await this.connection.createChannel();
    // Backpressure: cap unacked messages so a high-volume stream (e.g. document.viewed) isn't all
    // pulled into memory at once. Plugin calls are serialized per instance anyway (PluginManager).
    await this.channel.prefetch(16);
    await this.channel.assertExchange(this.broker.exchange, this.broker.exchangeType, { durable: true });
    const queue = queueName(this.broker, this.hostId);
    // autoDelete so a host that goes away doesn't leave a queue accumulating every event forever;
    // it lives while at least one replica of this host is connected. (Live-subscription semantics:
    // events published while a host is fully down are not retained for it.)
    const q = await this.channel.assertQueue(queue, { durable: false, autoDelete: true });
    // Fanout ignores the routing key; for topic/direct an empty key binds to the default.
    await this.channel.bindQueue(q.queue, this.broker.exchange, "");
    await this.channel.consume(q.queue, (msg) => this.onMessage(msg), { noAck: false });

    this.log.info({ exchange: this.broker.exchange, queue: q.queue }, "Broker consumer started");
  }

  async close(): Promise<void> {
    this.intentionalClose = true;
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      // Ignore close errors
    } finally {
      this.channel = null;
      this.connection = null;
    }
  }

  private async onMessage(msg: amqp.ConsumeMessage | null): Promise<void> {
    if (!msg) return;
    try {
      const cloudEvent = JSON.parse(msg.content.toString("utf-8")) as CloudEventJson;
      await this.route(this.key, cloudEvent);
      this.channel?.ack(msg);
    } catch (err) {
      this.log.warn({ error: (err as Error).message }, "Failed to process event message; dropping");
      // Don't requeue: a malformed message would loop forever.
      this.channel?.nack(msg, false, false);
    }
  }
}

/**
 * Owns one {@link BrokerConsumer} per distinct GZAC broker and keeps them in sync with the
 * configuration registry. Brokers are learned from the configurations GZAC pushes — the host never
 * configures a broker itself — so a single host serves many GZAC instances, each on its own broker.
 *
 * Call {@link sync} after any configuration mutation: it opens consumers for newly referenced
 * brokers and closes consumers no configuration references any more. An event consumed from a broker
 * is delivered only to configurations carrying that same broker whose manifest subscribes to the
 * event's CloudEvent `type`.
 */
export class EventConsumerManager {
  private readonly log: HostLogger;
  private readonly consumers = new Map<string, BrokerConsumer>();
  private chain: Promise<void> = Promise.resolve();
  private closing = false;

  constructor(
    private readonly pluginManager: PluginManager,
    private readonly configRegistry: ConfigRegistry,
    private readonly hostId: string,
    logger: HostLogger
  ) {
    this.log = logger.child({ component: "EventConsumerManager" });
  }

  /** Reconcile active broker consumers with the brokers referenced by the registry. Serialized. */
  sync(): Promise<void> {
    this.chain = this.chain
      .then(() => this.reconcile())
      .catch((err) => this.log.error({ error: (err as Error).message }, "Event consumer sync failed"));
    return this.chain;
  }

  async close(): Promise<void> {
    this.closing = true;
    await Promise.all(Array.from(this.consumers.values()).map((c) => c.close()));
    this.consumers.clear();
  }

  private async reconcile(): Promise<void> {
    if (this.closing) return;

    const desired = new Map<string, EventBrokerConfig>();
    for (const cfg of this.configRegistry.list()) {
      if (cfg.eventBroker?.amqpUrl) desired.set(brokerKey(cfg.eventBroker), cfg.eventBroker);
    }

    for (const [key, broker] of desired) {
      if (this.consumers.has(key)) continue;
      const consumer = new BrokerConsumer(
        key,
        broker,
        this.hostId,
        (k, event) => this.dispatch(k, event),
        (k) => this.consumers.delete(k),
        this.log
      );
      try {
        await consumer.start();
        this.consumers.set(key, consumer);
      } catch (err) {
        // Leave it out of the map so the next sync retries this broker.
        this.log.error(
          { exchange: broker.exchange, error: (err as Error).message },
          "Failed to start broker consumer — events from this broker will not be delivered"
        );
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
    const event = {
      type,
      id: cloudEvent.id ?? "",
      source: cloudEvent.source ?? "",
      time: cloudEvent.time,
      userId: data.userId,
      roles: data.roles,
      resultType: data.resultType,
      resultId: data.resultId,
      result: data.result,
    };

    for (const cfg of this.configRegistry.list()) {
      if (!cfg.eventBroker || brokerKey(cfg.eventBroker) !== key) continue;
      const manifest = this.pluginManager.getManifest(cfg.pluginId, cfg.pluginVersion);
      if (!manifest?.eventSubscriptions?.includes(type)) continue;

      try {
        await this.pluginManager.callEvent(cfg.pluginId, cfg.pluginVersion, {
          configurationId: cfg.configurationId,
          configuration: cfg.properties,
          event,
          serviceToken: cfg.serviceToken,
          gzacBaseUrl: cfg.gzacBaseUrl,
        });
      } catch (err) {
        this.log.warn(
          {
            configurationId: cfg.configurationId,
            pluginId: cfg.pluginId,
            type,
            error: (err as Error).message,
          },
          "handle_event invocation failed"
        );
      }
    }
  }
}
