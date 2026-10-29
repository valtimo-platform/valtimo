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
 * What GZAC pushes to `POST/PUT /api/host/configurations/:configId`. The app keeps this per active
 * configuration so it can (a) run actions/requests against the right properties and (b) call back
 * into GZAC with the per-configuration service token. This demo keeps it in memory — an app is
 * free to persist it, but nothing here requires a database.
 */
export interface EventBrokerConfig {
  amqpUrl: string;
  exchange: string;
  exchangeType: string;
  queueMode: "live" | "durable";
  queueTtlMs?: number | null;
}

export interface ConfigRecord {
  configurationId: string;
  pluginId: string;
  pluginVersion: string;
  properties: Record<string, unknown>;
  serviceToken: string;
  gzacBaseUrl: string;
  eventSubscriptions: string[];
  eventBroker: EventBrokerConfig | null;
  /**
   * Identity of the GZAC↔host relationship that pushed this configuration (GZAC's host-row UUID,
   * opaque to the app). Echoed in the configuration listing so GZAC's reconciliation pass can
   * delete its own orphaned configs without touching another GZAC's. Null when the pushing GZAC
   * predates ownership.
   */
  ownerId: string | null;
}

/** In-memory registry of pushed configurations, keyed by configuration id. */
export class ConfigStore {
  private readonly configs = new Map<string, ConfigRecord>();

  set(record: ConfigRecord): void {
    this.configs.set(record.configurationId, record);
  }

  get(configurationId: string): ConfigRecord | undefined {
    return this.configs.get(configurationId);
  }

  delete(configurationId: string): boolean {
    return this.configs.delete(configurationId);
  }

  list(): ConfigRecord[] {
    return [...this.configs.values()];
  }
}
