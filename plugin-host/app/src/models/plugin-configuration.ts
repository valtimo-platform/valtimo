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

import type { Endpoint } from "./plugin-manifest.js";

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
   * Host capabilities the admin granted at activation (`gzac_api`, `http_request`, `kv`, `log`).
   * Each host function checks this list before executing. Empty means the plugin cannot call any
   * host function.
   */
  grantedCapabilities?: string[];
  /**
   * GZAC endpoints the admin granted at activation (Ant-style `{method, pattern}` entries — `*`
   * matches one path segment, `**` any). The `gzac_api` host function refuses callbacks outside
   * this list before they leave the host; GZAC's own allowlist filter remains the authoritative
   * server-side gate. `undefined` means the owning GZAC instance predates endpoint pushing —
   * the host then logs a warning and allows the call (backward compatibility), relying on the
   * server-side filter alone.
   */
  grantedEndpoints?: Endpoint[];
  /**
   * Origins the `http_request` host function may call, accepted by the admin at activation. GZAC
   * pushes the union of the manifest's `permissions.egress` and the configuration properties marked
   * `x-egress-target`, so provenance is invisible here. Deny-by-default: an empty (or absent) list
   * means no outbound HTTP at all — see `security/egress-allowlist.ts`.
   */
  allowedEgress?: string[];
  /**
   * Event broker of the owning GZAC instance. Absent when the instance has no broker configured —
   * the configuration then receives no platform events (actions still work).
   */
  eventBroker?: EventBrokerConfig;
  /**
   * Opaque identity of the GZAC↔host relationship that owns this configuration (GZAC sends its
   * host-row UUID with every push). The GZAC-side reconciliation pass only ever deletes
   * configurations carrying its own ownerId, so multiple GZAC instances can share one host
   * without deleting each other's configs. Absent when pushed by a GZAC that predates ownership —
   * such rows are never auto-deleted.
   */
  ownerId?: string;
}
