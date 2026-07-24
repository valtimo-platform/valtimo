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
import {createNgModule, EnvironmentInjector, Injectable, Type} from '@angular/core';
import {Route, ROUTES, Router} from '@angular/router';
import {loadRemoteModule} from '@angular-architects/native-federation';
import {PLUGINS_TOKEN, PluginService, PluginSpecification} from '@valtimo/plugin';
import {TabService} from '@valtimo/case-management';
import {BuildingBlockManagementTabService} from '@valtimo/building-block-management';
import {
  BUILDING_BLOCK_MANAGEMENT_TAB_TOKEN,
  BuildingBlockManagementTabConfig,
  CASE_MANAGEMENT_TAB_TOKEN,
  CaseManagementTabConfig,
} from '@valtimo/shared';
import {NGXLogger} from 'ngx-logger';

import {aliasRemoteSharedToHost, RemoteEntry} from './native-federation-version-bridge';

/**
 * Loads plugins shipped as Native Federation remotes at application start time.
 *
 * These remotes are always loaded on every boot (wired via APP_INITIALIZER) —
 * there is no runtime install/enable step. Each remote is a separately-built
 * bundle, so it stays OUT of the host's build graph: a plugin the current user
 * has no access to simply is not served, and the host neither builds against it
 * nor loads it.
 *
 * For each exposed NgModule we instantiate it against the host's root injector
 * with `createNgModule`. That resolves the module's provider factories using the
 * host's shared services (so `enabled$` factories that depend on e.g.
 * PluginManagementService work), then we read its contribution tokens and push
 * them into the host's reactive registries. Registration is idempotent, so
 * loading a remote twice is harmless.
 *
 * This service is host-only glue and lives in `@valtimo/bootstrap` so all
 * consuming apps share a single implementation (see `provideNativeFederationPlugins`).
 */
@Injectable({providedIn: 'root'})
export class StartupPluginLoaderService {
  private static readonly MAX_ATTEMPTS = 3;
  private static readonly RETRY_DELAY_MS = 300;

  private readonly loadedRemotes = new Set<string>();

  constructor(
    private readonly injector: EnvironmentInjector,
    private readonly pluginService: PluginService,
    private readonly tabService: TabService,
    private readonly buildingBlockTabService: BuildingBlockManagementTabService,
    private readonly router: Router,
    private readonly logger: NGXLogger
  ) {}

  public async loadAll(remoteEntryUrls: string[]): Promise<void> {
    await Promise.all(remoteEntryUrls.map(url => this.load(url)));
  }

  public async load(remoteEntryUrl: string): Promise<void> {
    if (this.loadedRemotes.has(remoteEntryUrl)) return;
    // Reserve the URL to prevent a concurrent duplicate load; released on failure
    // so it can be retried on a later attempt rather than being permanently
    // skipped.
    this.loadedRemotes.add(remoteEntryUrl);

    // Fetching the remoteEntry can transiently fail during bootstrap (a fetch
    // race while es-module-shims / the dev server settle), so retry a few times
    // with a short backoff before giving up.
    for (let attempt = 1; attempt <= StartupPluginLoaderService.MAX_ATTEMPTS; attempt++) {
      try {
        await this.loadOnce(remoteEntryUrl);
        return;
      } catch (err) {
        if (attempt < StartupPluginLoaderService.MAX_ATTEMPTS) {
          this.logger.debug(
            `Loading plugin '${remoteEntryUrl}' failed (attempt ${attempt}), retrying.`,
            err
          );
          await this.delay(StartupPluginLoaderService.RETRY_DELAY_MS * attempt);
          continue;
        }
        this.loadedRemotes.delete(remoteEntryUrl);
        this.logger.error(
          `Failed to load plugin '${remoteEntryUrl}' after ${StartupPluginLoaderService.MAX_ATTEMPTS} attempts.`,
          err
        );
      }
    }
  }

  /** Single load attempt. Throws on fetch failure so `load` can retry. */
  private async loadOnce(remoteEntryUrl: string): Promise<void> {
    const response = await fetch(remoteEntryUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} loading ${remoteEntryUrl}`);
    }
    const entry: RemoteEntry = await response.json();
    aliasRemoteSharedToHost(entry);

    for (const exposed of entry.exposes ?? []) {
      try {
        const loaded = await loadRemoteModule({
          remoteEntry: remoteEntryUrl,
          exposedModule: exposed.key,
        });
        this.registerLoadedModule(loaded as Record<string, unknown>);
      } catch (err) {
        this.logger.error(
          `Failed to load exposed module '${exposed.key}' from '${remoteEntryUrl}'.`,
          err
        );
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Instantiate every exposed NgModule against the host's root injector and
   * register its plugin specifications and management tabs with the host.
   */
  private registerLoadedModule(loaded: Record<string, unknown>): void {
    for (const exportName of Object.keys(loaded)) {
      const exported = loaded[exportName];
      if (typeof exported !== 'function' || !(exported as {ɵmod?: unknown}).ɵmod) continue;

      const moduleRef = createNgModule(exported as Type<unknown>, this.injector);

      const specifications = this.toArray<PluginSpecification>(
        moduleRef.injector.get(PLUGINS_TOKEN, [])
      );
      this.pluginService.registerPluginSpecifications(specifications);
      // The plugin's config/function components are non-standalone and declared
      // in this module, so the host must create them with this module's injector
      // (not its own element injector) to resolve module-scoped providers.
      specifications.forEach(specification =>
        this.pluginService.registerPluginEnvironmentInjector(
          specification.pluginId,
          moduleRef.injector
        )
      );
      this.tabService.registerCaseManagementTabs(
        this.toArray<CaseManagementTabConfig>(moduleRef.injector.get(CASE_MANAGEMENT_TAB_TOKEN, []))
      );
      this.buildingBlockTabService.registerBuildingBlockTabs(
        this.toArray<BuildingBlockManagementTabConfig>(
          moduleRef.injector.get(BUILDING_BLOCK_MANAGEMENT_TAB_TOKEN, [])
        )
      );
      this.registerRoutes(moduleRef.injector.get(ROUTES, []));
    }
  }

  /**
   * Register the routes a plugin module declares via RouterModule.forChild into
   * the live Router. At bootstrap these would be merged automatically, but a
   * remote instantiated after bootstrap never feeds its ROUTES to the running
   * Router — so its own management pages (e.g. the mail-template editor at
   * `.../mail-template/:templateKey`) wouldn't match. The ROUTES token is a multi
   * provider holding arrays of routes; we flatten and append the ones not already
   * registered. The app has no wildcard route (unmatched URLs hit the Router
   * errorHandler), so appending is safe and order-independent.
   */
  private registerRoutes(routeConfigs: Route[][]): void {
    const pluginRoutes = (routeConfigs ?? []).flat();
    if (pluginRoutes.length === 0) return;

    const knownPaths = new Set(this.router.config.map(route => route.path));
    const additions = pluginRoutes.filter(route => !knownPaths.has(route.path));
    if (additions.length > 0) {
      this.router.resetConfig([...this.router.config, ...additions]);
    }
  }

  private toArray<T>(value: unknown): T[] {
    if (Array.isArray(value)) return value.flat() as T[];
    return value ? [value as T] : [];
  }
}
