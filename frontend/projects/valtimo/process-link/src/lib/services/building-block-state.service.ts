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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Injectable, OnDestroy} from '@angular/core';
import {BehaviorSubject, combineLatest, map, Observable, Subscription} from 'rxjs';
import {BuildingBlockManagementApiService} from '@valtimo/building-block-management';
import {ProcessLink} from '../models';

@Injectable({
  providedIn: 'root',
})
export class BuildingBlockStateService implements OnDestroy {
  private readonly _definitionKey$ = new BehaviorSubject<string | null>(null);
  private readonly _definitionVersionTag$ = new BehaviorSubject<string | null>(null);
  private readonly _versions$ = new BehaviorSubject<Array<string>>([]);
  private readonly _requiredPluginKeys$ = new BehaviorSubject<Array<string>>([]);
  private readonly _pluginMappings$ = new BehaviorSubject<Record<string, string | null>>({});
  private readonly _loadingRequirements$ = new BehaviorSubject<boolean>(false);

  private _versionSubscription?: Subscription;
  private _requirementsSubscription?: Subscription;

  constructor(
    private readonly buildingBlockManagementApiService: BuildingBlockManagementApiService
  ) {}

  public get definitionKey$(): Observable<string | null> {
    return this._definitionKey$.asObservable();
  }

  public get definitionVersionTag$(): Observable<string | null> {
    return this._definitionVersionTag$.asObservable();
  }

  public get versions$(): Observable<Array<string>> {
    return this._versions$.asObservable();
  }

  public get requiredPluginKeys$(): Observable<Array<string>> {
    return this._requiredPluginKeys$.asObservable();
  }

  public get pluginMappings$(): Observable<Record<string, string | null>> {
    return this._pluginMappings$.asObservable();
  }

  public get requirementsLoading$(): Observable<boolean> {
    return this._loadingRequirements$.asObservable();
  }

  public get mappingsComplete$(): Observable<boolean> {
    return combineLatest([
      this.requiredPluginKeys$,
      this.pluginMappings$,
      this.definitionVersionTag$,
    ]).pipe(map(([keys, mappings, version]) => !!version && keys.every(key => !!mappings[key])));
  }

  public setDefinitionKey(key: string | null, initialVersionTag?: string): void {
    this._definitionKey$.next(key);
    this._definitionVersionTag$.next(null);
    this._versions$.next([]);
    this.clearPluginRequirements();

    this._versionSubscription?.unsubscribe();
    if (!key) return;

    this._versionSubscription = this.buildingBlockManagementApiService
      .getBuildingBlockVersions(key)
      .subscribe({
        next: versions => {
          this._versions$.next(versions ?? []);
          if (initialVersionTag) {
            this.setDefinitionVersionTag(initialVersionTag, true);
          }
        },
        error: () => {
          this._versions$.next([]);
        },
      });
  }

  public setProcessLink(processLink: ProcessLink | undefined): void {
    if (!processLink) {
      this.reset();
      return;
    }

    if (processLink.processLinkType === 'building-block') {
      this.setDefinitionKey(
        processLink.buildingBlockDefinitionKey ?? null,
        processLink.buildingBlockDefinitionVersionTag ?? undefined
      );
      this.setPluginConfigurationMappings(
        processLink.pluginConfigurationMappings as Record<string, string>
      );
    } else {
      this.reset();
    }
  }

  public setDefinitionVersionTag(
    versionTag: string | null,
    preserveMappings: boolean = false
  ): void {
    this._definitionVersionTag$.next(versionTag);
    this.clearPluginRequirements({preserveMappings});

    const key = this._definitionKey$.getValue();
    if (key && versionTag) {
      this.loadPluginRequirements(key, versionTag);
    }
  }

  public setPluginConfigurationMapping(
    pluginDefinitionKey: string,
    configurationId: string | null
  ): void {
    const current = this._pluginMappings$.getValue();
    this._pluginMappings$.next({
      ...current,
      [pluginDefinitionKey]: configurationId,
    });
  }

  public setPluginConfigurationMappings(mappings: Record<string, string> | undefined): void {
    const normalized: Record<string, string | null> = {};
    Object.entries(mappings ?? {}).forEach(([key, value]) => {
      normalized[key] = value;
    });
    this._pluginMappings$.next(normalized);
  }

  public getPluginConfigurationMappingsSnapshot(): Record<string, string | null> {
    return {...this._pluginMappings$.getValue()};
  }

  public getDefinitionSnapshot(): {key: string | null; versionTag: string | null} {
    return {
      key: this._definitionKey$.getValue(),
      versionTag: this._definitionVersionTag$.getValue(),
    };
  }

  public reset(): void {
    this._definitionKey$.next(null);
    this._definitionVersionTag$.next(null);
    this._versions$.next([]);
    this._pluginMappings$.next({});
    this.clearPluginRequirements();
  }

  public ngOnDestroy(): void {
    this._versionSubscription?.unsubscribe();
    this._requirementsSubscription?.unsubscribe();
  }

  private loadPluginRequirements(key: string, versionTag: string): void {
    this._loadingRequirements$.next(true);
    this._requirementsSubscription?.unsubscribe();
    this._requirementsSubscription = this.buildingBlockManagementApiService
      .getPluginDefinitionsForBuildingBlock(key, versionTag)
      .subscribe({
        next: pluginKeys => {
          this.applyPluginKeys(pluginKeys ?? []);
          this._loadingRequirements$.next(false);
        },
        error: () => {
          this.applyPluginKeys([]);
          this._loadingRequirements$.next(false);
        },
      });
  }

  private applyPluginKeys(pluginKeys: Array<string>): void {
    const currentMappings = this._pluginMappings$.getValue();
    const normalized: Record<string, string | null> = {};
    pluginKeys.forEach(key => {
      normalized[key] = currentMappings[key] ?? null;
    });
    this._requiredPluginKeys$.next(pluginKeys);
    this._pluginMappings$.next(normalized);
  }

  private clearPluginRequirements(options: {preserveMappings?: boolean} = {}): void {
    this._requirementsSubscription?.unsubscribe();
    this._requiredPluginKeys$.next([]);
    if (!options.preserveMappings) {
      this._pluginMappings$.next({});
    }
    this._loadingRequirements$.next(false);
  }
}
