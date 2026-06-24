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

/**
 * Connection details for the event broker of the GZAC instance that owns a configuration. Pushed by
 * GZAC alongside the configuration — the host never configures a broker itself, because a single
 * host serves multiple GZAC instances, each with its own broker. The host opens one consumer per
 * distinct broker and routes its events only to configurations that carry the matching broker.
 */
export interface EventBrokerConfig {
  /** AMQP URL the host should connect to, e.g. `amqp://guest:guest@rabbitmq:5672`. */
  amqpUrl: string;
  /** Exchange the GZAC instance's outbox publishes to (typically `valtimo-events`). */
  exchange: string;
  /** Exchange type — must match the GZAC instance's declaration. */
  exchangeType: "fanout" | "topic" | "direct";
  /**
   * Per-host queue declaration mode the GZAC admin chose for this host:
   * - `"live"`: queue is `durable:false, autoDelete:true`. Events while the host is down are lost.
   * - `"durable"`: queue is `durable:true, autoDelete:false` with `x-expires = queueTtlMs`. Events
   *   are retained for up to that TTL since the last consumer disconnected.
   *
   * Absent or unrecognised values are treated as `"live"` (older GZAC instances don't push this).
   */
  queueMode?: "live" | "durable";
  /**
   * Queue inactivity TTL in milliseconds. Required when `queueMode === "durable"`; ignored
   * (treated as undefined) when `queueMode === "live"`.
   */
  queueTtlMs?: number;
}

export interface PluginConfiguration {
  configurationId: string;
  pluginId: string;
  pluginVersion: string;
  properties: Record<string, unknown>;
  /**
   * Service token GZAC issues for this configuration. The host attaches it as a Bearer token
   * on outbound `gzac_api` callbacks.
   */
  serviceToken: string;
  /**
   * Base URL of the GZAC instance that owns this configuration. The host appends the path the
   * plugin requests in `gzac_api` to this URL.
   */
  gzacBaseUrl: string;
  /**
   * CloudEvent types the admin granted this configuration at activation. The dispatch loop only
   * invokes `handle_event` for types in this set, regardless of what the manifest declares — so a
   * later manifest update that adds an event type cannot silently start delivering it. Empty
   * (or absent) means the plugin receives no events.
   */
  eventSubscriptions: string[];
  /**
   * Event broker of the owning GZAC instance. Absent when the instance has no broker configured —
   * the configuration then receives no platform events (actions still work).
   */
  eventBroker?: EventBrokerConfig;
}
