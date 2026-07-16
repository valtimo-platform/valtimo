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

export interface PluginLogEntry {
  id: number;
  configurationId: string;
  pluginId: string;
  pluginVersion: string;
  level: string;
  message: string;
  data: unknown;
  source: string;
  createdAt: string;
}

export interface LogQueryParams {
  page: number;
  size: number;
  level?: string;
  source?: string;
}

export interface LogPage {
  content: PluginLogEntry[];
  page: number;
  size: number;
  totalElements: number;
}

export class LogRepository {
  constructor(private pool: DbPool) {}

  async insert(entry: {
    configurationId: string;
    pluginId: string;
    pluginVersion: string;
    level: string;
    message: string;
    data?: unknown;
    source: string;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO plugin_logs (configuration_id, plugin_id, plugin_version, level, message, data, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.configurationId,
        entry.pluginId,
        entry.pluginVersion,
        entry.level,
        entry.message.slice(0, 4096),
        entry.data ? JSON.stringify(entry.data) : null,
        entry.source,
      ]
    );
  }

  async query(configurationId: string, params: LogQueryParams): Promise<LogPage> {
    const conditions = ["configuration_id = $1"];
    const values: unknown[] = [configurationId];
    let paramIdx = 2;

    if (params.level) {
      conditions.push(`level = $${paramIdx}`);
      values.push(params.level);
      paramIdx++;
    }
    if (params.source) {
      conditions.push(`source = $${paramIdx}`);
      values.push(params.source);
      paramIdx++;
    }

    const where = conditions.join(" AND ");
    const offset = params.page * params.size;
    const limit = Math.min(params.size, 100);

    const countResult = await this.pool.query(
      `SELECT COUNT(*) as total FROM plugin_logs WHERE ${where}`,
      values
    );
    const totalElements = parseInt(countResult.rows[0].total, 10);

    const { rows } = await this.pool.query(
      `SELECT id, configuration_id, plugin_id, plugin_version, level, message, data, source, created_at
       FROM plugin_logs WHERE ${where}
       ORDER BY created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      values
    );

    return {
      content: rows.map(this.mapRow),
      page: params.page,
      size: limit,
      totalElements,
    };
  }

  async deleteOlderThan(days: number): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM plugin_logs WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
      [days]
    );
    return result.rowCount ?? 0;
  }

  async deleteByConfiguration(configurationId: string): Promise<void> {
    await this.pool.query(
      "DELETE FROM plugin_logs WHERE configuration_id = $1",
      [configurationId]
    );
  }

  private mapRow(row: Record<string, unknown>): PluginLogEntry {
    return {
      id: row.id as number,
      configurationId: row.configuration_id as string,
      pluginId: row.plugin_id as string,
      pluginVersion: row.plugin_version as string,
      level: row.level as string,
      message: row.message as string,
      data: row.data,
      source: row.source as string,
      createdAt: (row.created_at as Date).toISOString(),
    };
  }
}
