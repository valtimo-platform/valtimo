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

import type { PluginConfiguration } from "./models/index.js";
import type { ConfigRepository } from "./db/config-repository.js";

/**
 * Configuration registry backed by database storage.
 *
 * Maps configurationId → { decrypted properties, plugin routing info }.
 * GZAC pushes configurations here on activation; the host injects them
 * into every Wasm call.
 *
 * Configurations are persisted to PostgreSQL and survive host restarts.
 */
export class ConfigRegistry {
  constructor(private repo: ConfigRepository) {}

  async set(configurationId: string, config: PluginConfiguration): Promise<void> {
    await this.repo.set(configurationId, config);
  }

  async get(configurationId: string): Promise<PluginConfiguration | undefined> {
    return this.repo.get(configurationId);
  }

  async delete(configurationId: string): Promise<boolean> {
    return this.repo.delete(configurationId);
  }

  async list(): Promise<PluginConfiguration[]> {
    return this.repo.list();
  }

  async listByPlugin(pluginId: string, pluginVersion: string): Promise<PluginConfiguration[]> {
    return this.repo.listByPlugin(pluginId, pluginVersion);
  }
}
