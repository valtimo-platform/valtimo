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
import type { PluginManifest } from "../models/index.js";

export class PluginRepository {
  constructor(private pool: DbPool) {}

  async upsert(pluginId: string, version: string, manifest: PluginManifest): Promise<void> {
    await this.pool.query(
      `INSERT INTO plugins (plugin_id, version, manifest)
       VALUES ($1, $2, $3)
       ON CONFLICT (plugin_id, version) DO UPDATE SET manifest = EXCLUDED.manifest`,
      [pluginId, version, JSON.stringify(manifest)]
    );
  }

  async get(pluginId: string, version: string): Promise<PluginManifest | undefined> {
    const { rows } = await this.pool.query(
      "SELECT manifest FROM plugins WHERE plugin_id = $1 AND version = $2",
      [pluginId, version]
    );
    if (rows.length === 0) return undefined;
    return rows[0].manifest as PluginManifest;
  }

  async delete(pluginId: string, version: string): Promise<boolean> {
    const result = await this.pool.query(
      "DELETE FROM plugins WHERE plugin_id = $1 AND version = $2",
      [pluginId, version]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async list(): Promise<Array<{ pluginId: string; version: string; manifest: PluginManifest }>> {
    const { rows } = await this.pool.query(
      "SELECT plugin_id, version, manifest FROM plugins ORDER BY plugin_id, version"
    );
    return rows.map((row) => ({
      pluginId: row.plugin_id as string,
      version: row.version as string,
      manifest: row.manifest as PluginManifest,
    }));
  }

  async listVersions(pluginId: string): Promise<Array<{ version: string; manifest: PluginManifest }>> {
    const { rows } = await this.pool.query(
      "SELECT version, manifest FROM plugins WHERE plugin_id = $1 ORDER BY version",
      [pluginId]
    );
    return rows.map((row) => ({
      version: row.version as string,
      manifest: row.manifest as PluginManifest,
    }));
  }
}
