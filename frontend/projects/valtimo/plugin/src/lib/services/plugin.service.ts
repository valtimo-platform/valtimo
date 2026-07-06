/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

import {EnvironmentInjector, Inject, Injectable} from '@angular/core';
import {PluginConfig, PluginSpecification} from '../models';
import {BehaviorSubject, Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {PLUGINS_TOKEN} from '../constants';

@Injectable({
  providedIn: 'root',
})
export class PluginService {
  private readonly _pluginSpecifications$ = new BehaviorSubject<Array<PluginSpecification>>([]);
  private readonly _availablePluginIds$ = this._pluginSpecifications$.pipe(
    map(pluginSpecifications => pluginSpecifications.map(specification => specification.pluginId))
  );

  /**
   * Environment injector per plugin id, for plugins loaded at runtime (Native
   * Federation remotes). Their non-standalone configuration/function components
   * live in a separate module injector, so the host must create them with that
   * injector to resolve module-scoped providers. Compile-time plugins have no
   * entry here and are created with the host's default injector, as before.
   */
  private readonly _pluginEnvironmentInjectors = new Map<string, EnvironmentInjector>();

  constructor(@Inject(PLUGINS_TOKEN) private readonly pluginConfig: PluginConfig) {
    this._pluginSpecifications$.next(pluginConfig);
  }

  get pluginSpecifications$(): Observable<Array<PluginSpecification>> {
    return this._pluginSpecifications$.asObservable();
  }

  get pluginSpecifications(): Array<PluginSpecification> {
    return this._pluginSpecifications$.getValue();
  }

  get availablePluginIds$(): Observable<Array<string>> {
    return this._availablePluginIds$;
  }

  /**
   * Register plugin specifications after bootstrap — used when a plugin is loaded
   * at runtime (e.g. shipped as a Native Federation remote) rather than compiled
   * into the app via the PLUGINS_TOKEN provider. Downstream consumers subscribe
   * to `pluginSpecifications$` / `availablePluginIds$`, so the plugin-management
   * UI picks up the additions reactively. Idempotent by `pluginId`, so loading
   * the same remote twice does not create duplicates.
   */
  public registerPluginSpecifications(specifications: Array<PluginSpecification>): void {
    const current = this._pluginSpecifications$.getValue();
    const knownIds = new Set(current.map(specification => specification.pluginId));
    const additions = specifications.filter(specification => !knownIds.has(specification.pluginId));

    if (additions.length > 0) {
      this._pluginSpecifications$.next([...current, ...additions]);
    }
  }

  /**
   * Associate a plugin id with the environment injector its components must be
   * created with (see `_pluginEnvironmentInjectors`). Called by the runtime
   * plugin loader for each plugin a federated remote contributes.
   */
  public registerPluginEnvironmentInjector(pluginId: string, injector: EnvironmentInjector): void {
    this._pluginEnvironmentInjectors.set(pluginId, injector);
  }

  public getPluginEnvironmentInjector(pluginId: string): EnvironmentInjector | undefined {
    return this._pluginEnvironmentInjectors.get(pluginId);
  }
}
