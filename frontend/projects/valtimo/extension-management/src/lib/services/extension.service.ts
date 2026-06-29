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
import {Injectable} from '@angular/core';
import {CASE_MANAGEMENT_TAB_TOKEN, ConfigService} from '@valtimo/shared';
import {defer, from, Observable} from 'rxjs';
import {ExtensionListItem} from '../models';
import {PLUGINS_TOKEN, PluginService} from '@valtimo/plugin';
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
   * Walk every export of a loaded remote module, register any NgModule
   * `providers` we recognise (plugin specifications + case-management tabs).
   * Extensions remain free to add new contribution points without code changes
   * here, as long as they expose them via providers on a recognisable token.
   */
  private registerLoadedModule(loaded: Record<string, unknown>): void {
    for (const exportName of Object.keys(loaded)) {
      const value = loaded[exportName];
      if (!value || typeof value !== 'function') continue;
      const providers = this.extractModuleProviders(value);
      if (!providers.length) continue;

      providers
        .filter(p => p && p.provide === PLUGINS_TOKEN)
        .flatMap(p => (Array.isArray(p.useValue) ? p.useValue : [p.useValue]))
        .forEach(spec => this.pluginService.addPluginSpecification(spec));

      providers
        .filter(p => p && p.provide === CASE_MANAGEMENT_TAB_TOKEN)
        .flatMap(p => (Array.isArray(p.useValue) ? p.useValue : [p.useValue]))
        .forEach(tab => this.tabService.addCaseManagementTab(tab));
    }
  }

  private extractModuleProviders(maybeNgModule: any): any[] {
    // Angular's AOT compiler stores NgModule metadata under different keys
    // depending on whether the module was compiled in partial-Ivy or full-Ivy
    // mode. Check the well-known ones; fall back to empty.
    const candidates =
      maybeNgModule?.ɵmod?.providers ??
      maybeNgModule?.ɵinj?.providers ??
      maybeNgModule?.__annotations__?.flatMap((a: any) => a?.providers ?? []) ??
      [];
    return Array.isArray(candidates) ? candidates : [];
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
