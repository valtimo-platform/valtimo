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

export class KvRepository {
  constructor(private pool: DbPool) {}

  async get(configurationId: string, key: string): Promise<{ found: boolean; value: unknown }> {
    const { rows } = await this.pool.query(
      "SELECT value FROM plugin_kv WHERE configuration_id = $1 AND key = $2",
      [configurationId, key]
    );
    if (rows.length === 0) return { found: false, value: undefined };
    return { found: true, value: rows[0].value };
  }

  async set(configurationId: string, key: string, value: unknown): Promise<void> {
    await this.pool.query(
      `INSERT INTO plugin_kv (configuration_id, key, value, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (configuration_id, key) DO UPDATE SET
         value = EXCLUDED.value,
         updated_at = NOW()`,
      [configurationId, key, JSON.stringify(value)]
    );
  }

  async delete(configurationId: string, key: string): Promise<boolean> {
    const result = await this.pool.query(
      "DELETE FROM plugin_kv WHERE configuration_id = $1 AND key = $2",
      [configurationId, key]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async list(configurationId: string, prefix?: string): Promise<string[]> {
    let query: string;
    let params: unknown[];
    if (prefix) {
      const escaped = prefix.replace(/[%_\\]/g, "\\$&");
      query = "SELECT key FROM plugin_kv WHERE configuration_id = $1 AND key LIKE $2 ESCAPE '\\' ORDER BY key";
      params = [configurationId, escaped + "%"];
    } else {
      query = "SELECT key FROM plugin_kv WHERE configuration_id = $1 ORDER BY key";
      params = [configurationId];
    }
    const { rows } = await this.pool.query(query, params);
    return rows.map((r: Record<string, unknown>) => r.key as string);
  }

  async deleteAll(configurationId: string): Promise<void> {
    await this.pool.query(
      "DELETE FROM plugin_kv WHERE configuration_id = $1",
      [configurationId]
    );
  }
}
