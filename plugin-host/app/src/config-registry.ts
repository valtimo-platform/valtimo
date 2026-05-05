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

/**
 * In-memory configuration registry.
 *
 * Maps configurationId → { decrypted properties, plugin routing info }.
 * GZAC pushes configurations here on activation; the host injects them
 * into every Wasm call.
 *
 * POC scope: simplified — no GZAC instance tracking, no token lifecycle.
 */
export class ConfigRegistry {
  private configs = new Map<string, PluginConfiguration>();

  set(configurationId: string, config: PluginConfiguration): void {
    this.configs.set(configurationId, config);
  }

  get(configurationId: string): PluginConfiguration | undefined {
    return this.configs.get(configurationId);
  }

  delete(configurationId: string): boolean {
    return this.configs.delete(configurationId);
  }

  list(): PluginConfiguration[] {
    return Array.from(this.configs.values());
  }

  listByPlugin(
    pluginId: string,
    pluginVersion: string
  ): PluginConfiguration[] {
    return Array.from(this.configs.values()).filter(
      (c) => c.pluginId === pluginId && c.pluginVersion === pluginVersion
    );
  }
}
