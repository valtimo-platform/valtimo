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

import type { DbPool } from "./index.js";
import type { PluginConfiguration } from "../models/index.js";

export class ConfigRepository {
  constructor(private pool: DbPool) {}

  async set(configurationId: string, config: PluginConfiguration): Promise<void> {
    await this.pool.query(
      `INSERT INTO plugin_configurations
        (configuration_id, plugin_id, plugin_version, properties, service_token, gzac_base_url, event_broker, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (configuration_id) DO UPDATE SET
        plugin_id = EXCLUDED.plugin_id,
        plugin_version = EXCLUDED.plugin_version,
        properties = EXCLUDED.properties,
        service_token = EXCLUDED.service_token,
        gzac_base_url = EXCLUDED.gzac_base_url,
        event_broker = EXCLUDED.event_broker,
        updated_at = NOW()`,
      [
        configurationId,
        config.pluginId,
        config.pluginVersion,
        JSON.stringify(config.properties),
        config.serviceToken,
        config.gzacBaseUrl,
        config.eventBroker ? JSON.stringify(config.eventBroker) : null,
      ]
    );
  }

  async get(configurationId: string): Promise<PluginConfiguration | undefined> {
    const { rows } = await this.pool.query(
      `SELECT configuration_id, plugin_id, plugin_version, properties, service_token, gzac_base_url, event_broker
       FROM plugin_configurations WHERE configuration_id = $1`,
      [configurationId]
    );

    if (rows.length === 0) return undefined;
    return this.mapRow(rows[0]);
  }

  async delete(configurationId: string): Promise<boolean> {
    const result = await this.pool.query(
      "DELETE FROM plugin_configurations WHERE configuration_id = $1",
      [configurationId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async list(): Promise<PluginConfiguration[]> {
    const { rows } = await this.pool.query(
      `SELECT configuration_id, plugin_id, plugin_version, properties, service_token, gzac_base_url, event_broker
       FROM plugin_configurations ORDER BY created_at`
    );
    return rows.map(this.mapRow);
  }

  async listByPlugin(pluginId: string, pluginVersion: string): Promise<PluginConfiguration[]> {
    const { rows } = await this.pool.query(
      `SELECT configuration_id, plugin_id, plugin_version, properties, service_token, gzac_base_url, event_broker
       FROM plugin_configurations WHERE plugin_id = $1 AND plugin_version = $2 ORDER BY created_at`,
      [pluginId, pluginVersion]
    );
    return rows.map(this.mapRow);
  }

  private mapRow(row: Record<string, unknown>): PluginConfiguration {
    return {
      configurationId: row.configuration_id as string,
      pluginId: row.plugin_id as string,
      pluginVersion: row.plugin_version as string,
      properties: row.properties as Record<string, unknown>,
      serviceToken: row.service_token as string,
      gzacBaseUrl: row.gzac_base_url as string,
      eventBroker: row.event_broker as PluginConfiguration["eventBroker"],
    };
  }
}
