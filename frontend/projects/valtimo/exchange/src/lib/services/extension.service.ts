/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

import {HttpClient} from '@angular/common/http';
import {createNgModule, EnvironmentInjector, Injectable, Type} from '@angular/core';
import {Route, ROUTES, Router} from '@angular/router';
import {CASE_MANAGEMENT_TAB_TOKEN, ConfigService} from '@valtimo/shared';
import {defer, from, Observable} from 'rxjs';
import {ExtensionListItem} from '../models';
import {PLUGINS_TOKEN, PluginService, PluginSpecification} from '@valtimo/plugin';
import {NGXLogger} from 'ngx-logger';
import {TabService} from '@valtimo/case-management';
import {loadRemoteModule} from '@angular-architects/native-federation';

/**
 * The Native Federation `remoteEntry.json` produced by the extension's build.
 * Lists every module the extension exposes; the loader iterates this list
 * instead of relying on a hard-coded module name (so two different extensions
 * can expose differently-named modules without coordination).
 */
interface RemoteEntry {
  name?: string;
  exposes?: Array<{key: string; outFileName: string}>;
  shared?: Array<{packageName: string; outFileName: string; version: string}>;
}

/** Native Federation's global runtime cache (see @softarc/native-federation-runtime). */
interface NativeFederationGlobal {
  externals?: Map<string, string>;
}

const REMOTE_ENTRY_FILE = 'remoteEntry.json';
const REMOTE_STYLES_FILE = 'styles.css';

@Injectable({providedIn: 'root'})
export class ExtensionService {
  private readonly valtimoEndpointUri: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly http: HttpClient,
    private readonly pluginService: PluginService,
    private readonly tabService: TabService,
    private readonly injector: EnvironmentInjector,
    private readonly router: Router,
    private readonly logger: NGXLogger
  ) {
    this.valtimoEndpointUri = `${this.configService.config.valtimoApi.endpointUri}`;
  }

  public loadAll(): void {
    this.getExtensionIds('STARTED', REMOTE_ENTRY_FILE).subscribe(extensionIds => {
      extensionIds.forEach(extensionId => {
        this.load(extensionId).subscribe({
          error: err => this.logger.error(`Failed to load extension '${extensionId}'.`, err),
        });
      });
    });
    this.getExtensionIds('STARTED', REMOTE_STYLES_FILE).subscribe(extensionIds => {
      extensionIds.forEach(extensionId => this.loadStyle(extensionId));
    });
  }

  /**
   * Load a single extension's frontend bundle. We first fetch the federation
   * info ourselves so we know which modules the remote exposes, then defer to
   * the Native Federation runtime to actually load each one (it handles import
   * map merging, dedupe and the import() under the hood).
   */
  public load(extensionId: string): Observable<unknown> {
    const remoteEntryUrl = this.getFileUrl(extensionId, REMOTE_ENTRY_FILE);
    return defer(() =>
      from(
        fetch(remoteEntryUrl, {credentials: 'include'})
          .then(res => {
            if (!res.ok) {
              throw new Error(`HTTP ${res.status} loading ${remoteEntryUrl}`);
            }
            return res.json() as Promise<RemoteEntry>;
          })
          .then(async (entry: RemoteEntry) => {
            this.aliasRemoteSharedToHost(entry);
            const exposes = entry.exposes ?? [];
            for (const exposed of exposes) {
              try {
                const m = await loadRemoteModule({
                  remoteEntry: remoteEntryUrl,
                  exposedModule: exposed.key,
                });
                this.registerLoadedModule(m);
              } catch (err) {
                this.logger.error(
                  `Failed to load exposed module '${exposed.key}' from extension '${extensionId}'.`,
                  err
                );
              }
            }
            this.loadStyleIfPresent(extensionId);
            return true;
          })
      )
    );
  }

  /**
   * Bridge the version-key gap between the host and a prebuilt remote.
   *
   * Native Federation keys every shared dependency by the exact string
   * `packageName@version`. The host shares its workspace `@valtimo/*` libs as
   * tsconfig path-mappings, which carry no version (`@valtimo/plugin@`), while a
   * remote built against published packages declares a real version
   * (`@valtimo/plugin@13.34.0`). The keys don't match, so the remote would load
   * its OWN bundled copy of those libs instead of the host's — breaking
   * `PLUGINS_TOKEN` identity (its contribution silently fails to register) and
   * pulling in transitive deps the host doesn't serve.
   *
   * Here we point each version the remote declares at the host's already-loaded
   * chunk URL (registered by `initFederation`), so the remote dedupes onto the
   * host's instances. Runs before `loadRemoteModule`, whose remote-info
   * processing reads these entries when building the remote's import-map scope.
   */
  private aliasRemoteSharedToHost(entry: RemoteEntry): void {
    const nf = (globalThis as unknown as {__NATIVE_FEDERATION__?: NativeFederationGlobal})
      .__NATIVE_FEDERATION__;
    const externals = nf?.externals;
    if (!externals || !entry.shared?.length) {
      return;
    }

    // packageName -> host chunk URL, derived from the host's registered externals.
    const hostUrlByPackage = new Map<string, string>();
    for (const [key, url] of externals) {
      const at = key.lastIndexOf('@');
      const packageName = at > 0 ? key.slice(0, at) : key;
      if (!hostUrlByPackage.has(packageName)) {
        hostUrlByPackage.set(packageName, url);
      }
    }

    for (const shared of entry.shared) {
      const hostUrl = hostUrlByPackage.get(shared.packageName);
      if (hostUrl) {
        externals.set(`${shared.packageName}@${shared.version}`, hostUrl);
      }
    }
  }

  /**
   * Inject the extension's stylesheet only if it actually ships one. Not every
   * extension has a `styles.css`; requesting it unconditionally produces a 404
   * (and previously a blocked/empty response). We ask the backend which started
   * extensions contain the file and only then inject the <link>, so no 404 is
   * triggered for extensions without styles.
   */
  private loadStyleIfPresent(extensionId: string): void {
    this.getExtensionIds('STARTED', REMOTE_STYLES_FILE).subscribe({
      next: ids => {
        if (ids.includes(extensionId)) {
          this.loadStyle(extensionId);
        }
      },
      error: err =>
        this.logger.debug(`Could not determine stylesheet for extension '${extensionId}'.`, err),
    });
  }

  private loadStyle(extensionId: string): void {
    const head = document.getElementsByTagName('head')[0];
    const href = this.getFileUrl(extensionId, REMOTE_STYLES_FILE);
    let themeLink = document.getElementById(`${extensionId}-theme`) as HTMLLinkElement;
    if (themeLink) {
      themeLink.href = href;
    } else {
      const style = document.createElement('link');
      style.id = `${extensionId}-theme`;
      style.rel = 'stylesheet';
      style.type = 'text/css';
      style.href = href;
      head.appendChild(style);
    }
  }

  /**
   * Instantiate every exposed NgModule against the host's root injector and
   * register its contributions with the host.
   *
   * We create the module with `createNgModule` (rather than statically reading
   * `ɵmod.providers`) for two reasons: (1) provider factories that depend on
   * host services — e.g. a plugin spec's `enabled$` factory — resolve against
   * the host injector, and (2) the module's own ROUTES (declared via
   * `RouterModule.forChild` inside the modules it imports) only become
   * reachable this way. Registration is idempotent, so loading twice is safe.
   */
  private registerLoadedModule(loaded: Record<string, unknown>): void {
    for (const exportName of Object.keys(loaded)) {
      const exported = loaded[exportName];
      if (typeof exported !== 'function' || !(exported as {ɵmod?: unknown}).ɵmod) continue;

      const moduleRef = createNgModule(exported as Type<unknown>, this.injector);

      const specifications = this.toArray<PluginSpecification>(
        moduleRef.injector.get(PLUGINS_TOKEN, [])
      );
      if (specifications.length) {
        this.pluginService.registerPluginSpecifications(specifications);
        // A plugin's config/function components are declared in this module, so
        // the host must create them with this module's injector to resolve its
        // module-scoped providers.
        specifications.forEach(specification =>
          this.pluginService.registerPluginEnvironmentInjector(
            specification.pluginId,
            moduleRef.injector
          )
        );
      }

      const caseManagementTabs = this.toArray<unknown>(
        moduleRef.injector.get(CASE_MANAGEMENT_TAB_TOKEN, [])
      );
      if (caseManagementTabs.length) {
        this.tabService.registerCaseManagementTabs(caseManagementTabs as never);
      }

      this.registerRoutes(moduleRef.injector.get(ROUTES, []));
    }
  }

  /**
   * Append the routes a plugin module declares via `RouterModule.forChild` to
   * the live Router. A remote instantiated after bootstrap never feeds its
   * ROUTES to the running Router, so its own management pages (e.g. the
   * mail-template editor at `.../mail-template/:templateKey`) would not match.
   * The ROUTES token is a multi provider of route arrays; we flatten and append
   * the paths not already registered. The app has no wildcard route, so
   * appending is safe and order-independent.
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

  public getExtensions(): Observable<Array<ExtensionListItem>> {
    return this.http.get<Array<ExtensionListItem>>(
      `${this.valtimoEndpointUri}management/v1/extension`
    );
  }

  public installExtension(extensionId: string, version: string): Observable<void> {
    return this.http.post<void>(
      `${this.valtimoEndpointUri}management/v1/extension/${extensionId}/install/${version}`,
      null
    );
  }

  public updateExtension(extensionId: string, toVersion: string): Observable<void> {
    return this.http.post<void>(
      `${this.valtimoEndpointUri}management/v1/extension/${extensionId}/update/${toVersion}`,
      null
    );
  }

  public uninstallExtension(extensionId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.valtimoEndpointUri}management/v1/extension/${extensionId}`
    );
  }

  public getExtensionIds(state: string, file: string): Observable<Array<string>> {
    return this.http.get<Array<string>>(
      `${this.valtimoEndpointUri}v1/public/extension/id?state=${state}&file=${file}`
    );
  }

  public getFileUrl(extensionId: string, file: string): string {
    return `${this.valtimoEndpointUri}v1/public/extension/${extensionId}/file/${file}`;
  }

  public getFile(file: string, extensionId: string): Observable<string> {
    return this.http.get<string>(
      `${this.valtimoEndpointUri}v1/public/extension/${extensionId}/file/${file}`
    );
  }
}
