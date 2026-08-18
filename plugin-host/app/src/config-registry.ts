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
 *
 * Reads are served from a short-TTL in-memory cache so hot paths (one lookup per consumed event
 * per configuration, one per data/action call) don't hit Postgres every time. Writes through this
 * registry invalidate the cache immediately; a write done by ANOTHER replica against the shared
 * database becomes visible after at most `cacheTtlMs`. Pass `cacheTtlMs: 0` to disable caching.
 */
export class ConfigRegistry {
  private listCache: { configs: PluginConfiguration[]; expiresAt: number } | null = null;
  private readonly entryCache = new Map<
    string,
    { config: PluginConfiguration | undefined; expiresAt: number }
  >();

  constructor(
    private repo: ConfigRepository,
    private readonly cacheTtlMs: number = 10_000
  ) {}

  async set(configurationId: string, config: PluginConfiguration): Promise<void> {
    await this.repo.set(configurationId, config);
    this.invalidate();
  }

  async get(configurationId: string): Promise<PluginConfiguration | undefined> {
    if (this.cacheTtlMs > 0) {
      const cached = this.entryCache.get(configurationId);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.config;
      }
    }
    const config = await this.repo.get(configurationId);
    if (this.cacheTtlMs > 0) {
      this.entryCache.set(configurationId, { config, expiresAt: Date.now() + this.cacheTtlMs });
    }
    return config;
  }

  async delete(configurationId: string): Promise<boolean> {
    const deleted = await this.repo.delete(configurationId);
    this.invalidate();
    return deleted;
  }

  async list(): Promise<PluginConfiguration[]> {
    if (this.cacheTtlMs > 0 && this.listCache && this.listCache.expiresAt > Date.now()) {
      return this.listCache.configs;
    }
    const configs = await this.repo.list();
    if (this.cacheTtlMs > 0) {
      const expiresAt = Date.now() + this.cacheTtlMs;
      this.listCache = { configs, expiresAt };
      // A full read also refreshes the per-id entries, so a get() right after a list() is free.
      for (const config of configs) {
        this.entryCache.set(config.configurationId, { config, expiresAt });
      }
    }
    return configs;
  }

  async listByPlugin(pluginId: string, pluginVersion: string): Promise<PluginConfiguration[]> {
    // Uncached: only used by the (rare) admin plugin-delete guard, where staleness would risk
    // deleting a plugin a just-pushed configuration references.
    return this.repo.listByPlugin(pluginId, pluginVersion);
  }

  /** Drops all cached reads. Called after every write through this registry. */
  invalidate(): void {
    this.listCache = null;
    this.entryCache.clear();
  }
}
