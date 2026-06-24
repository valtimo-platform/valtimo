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
import {
  BuildingBlockField,
  BuildingBlockInputMapping,
  BuildingBlockOutputMapping,
  ProcessLink,
} from '../models';
import {ProcessLinkBuildingBlockApiService} from './process-link-building-block-api.service';
import {ensureDocPrefix} from '../utils';

@Injectable({
  providedIn: 'root',
})
export class BuildingBlockStateService implements OnDestroy {
  private readonly _definitionKey$ = new BehaviorSubject<string | null>(null);
  private readonly _definitionVersionTag$ = new BehaviorSubject<string | null>(null);
  private readonly _versions$ = new BehaviorSubject<Array<string>>([]);
  private readonly _requiredPluginKeys$ = new BehaviorSubject<Array<string>>([]);
  private readonly _pluginMappings$ = new BehaviorSubject<Record<string, string | null>>({});
  private readonly _buildingBlockFields$ = new BehaviorSubject<Array<BuildingBlockField>>([]);
  private readonly _inputMappings$ = new BehaviorSubject<Array<BuildingBlockInputMapping>>([]);
  private readonly _outputMappings$ = new BehaviorSubject<Array<BuildingBlockOutputMapping>>([]);
  private readonly _loadingRequirements$ = new BehaviorSubject<boolean>(false);
  private readonly _loadingFields$ = new BehaviorSubject<boolean>(false);
  private readonly _pluginDependencies$ = new BehaviorSubject<Array<string>>([]);
  private readonly _isNestedBuildingBlock$ = new BehaviorSubject<boolean>(false);

  private _versionSubscription?: Subscription;
  private _requirementsSubscription?: Subscription;
  private _fieldsSubscription?: Subscription;

  constructor(
    private readonly processLinkBuildingBlockApiService: ProcessLinkBuildingBlockApiService
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

  public get buildingBlockFields$(): Observable<Array<BuildingBlockField>> {
    return this._buildingBlockFields$.asObservable();
  }

  public get inputMappings$(): Observable<Array<BuildingBlockInputMapping>> {
    return this._inputMappings$.asObservable();
  }

  public get outputMappings$(): Observable<Array<BuildingBlockOutputMapping>> {
    return this._outputMappings$.asObservable();
  }

  public get requirementsLoading$(): Observable<boolean> {
    return this._loadingRequirements$.asObservable();
  }

  public get fieldsLoading$(): Observable<boolean> {
    return this._loadingFields$.asObservable();
  }

  public get pluginDependencies$(): Observable<Array<string>> {
    return this._pluginDependencies$.asObservable();
  }

  public get isNestedBuildingBlock$(): Observable<boolean> {
    return this._isNestedBuildingBlock$.asObservable();
  }

  public setIsNestedBuildingBlock(isNested: boolean): void {
    this._isNestedBuildingBlock$.next(isNested);
  }

  public get mappingsComplete$(): Observable<boolean> {
    return combineLatest([
      this.requiredPluginKeys$,
      this.pluginMappings$,
      this.definitionVersionTag$,
      this.isNestedBuildingBlock$,
    ]).pipe(
      map(
        ([keys, mappings, version, isNested]) =>
          !!version && (isNested || keys.every(key => !!mappings[key]))
      )
    );
  }

  public setDefinitionKey(key: string | null, initialVersionTag?: string): void {
    this._definitionKey$.next(key);
    this._definitionVersionTag$.next(null);
    this._versions$.next([]);
    this.clearPluginRequirements();
    this.clearMappings();
    this.clearFields();

    this._versionSubscription?.unsubscribe();
    if (!key) return;

    this._versionSubscription = this.processLinkBuildingBlockApiService
      .getVersionsForBuildingBlock(key)
      .subscribe({
        next: versions => {
          this._versions$.next(
            versions.content.map(version => {
              return version.versionTag;
            }) ?? []
          );
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
      this.setInputMappings(processLink.inputMappings ?? []);
      this.setOutputMappings(processLink.outputMappings ?? []);
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
    this.clearFields();
    this.clearMappings({preserveMappings});

    const key = this._definitionKey$.getValue();
    if (key && versionTag) {
      this.loadPluginRequirements(key, versionTag);
      this.loadFields(key, versionTag);
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

  public setInputMappings(mappings: Array<BuildingBlockInputMapping>): void {
    this._inputMappings$.next(
      (mappings ?? []).map(m => ({
        ...m,
        source: ensureDocPrefix(m.source),
        target: ensureDocPrefix(m.target),
      }))
    );
  }

  public setOutputMappings(mappings: Array<BuildingBlockOutputMapping>): void {
    this._outputMappings$.next(
      (mappings ?? []).map(m => ({
        ...m,
        source: ensureDocPrefix(m.source),
        target: ensureDocPrefix(m.target),
      }))
    );
  }

  public getInputMappingsSnapshot(): Array<BuildingBlockInputMapping> {
    return [...this._inputMappings$.getValue()];
  }

  public getOutputMappingsSnapshot(): Array<BuildingBlockOutputMapping> {
    return [...this._outputMappings$.getValue()];
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

  public getBuildingBlockFieldsSnapshot(): Array<BuildingBlockField> {
    return [...this._buildingBlockFields$.getValue()];
  }

  public reset(): void {
    this._definitionKey$.next(null);
    this._definitionVersionTag$.next(null);
    this._versions$.next([]);
    this._pluginMappings$.next({});
    this._isNestedBuildingBlock$.next(false);
    this.clearFields();
    this.clearMappings();
    this.clearPluginRequirements();
  }

  public ngOnDestroy(): void {
    this._versionSubscription?.unsubscribe();
    this._requirementsSubscription?.unsubscribe();
    this._fieldsSubscription?.unsubscribe();
  }

  private loadPluginRequirements(key: string, versionTag: string): void {
    this._loadingRequirements$.next(true);
    this._requirementsSubscription?.unsubscribe();
    this._requirementsSubscription = this.processLinkBuildingBlockApiService
      .getPluginDefinitionsForBuildingBlock(key, versionTag)
      .subscribe({
        next: res => {
          const plugins = res?.plugins ?? [];
          const pluginKeys = plugins.map(plugin => plugin.pluginDefinitionKey).filter(Boolean);
          const dependencies: string[] = Array.from(
            new Set(plugins.flatMap(p => p.dependencies ?? []).map(d => d.key))
          );

          this.applyPluginKeys(pluginKeys ?? []);
          this._pluginDependencies$.next(dependencies);
          this._loadingRequirements$.next(false);
        },
        error: () => {
          this.applyPluginKeys([]);
          this._pluginDependencies$.next([]);
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

  private loadFields(key: string, versionTag: string): void {
    this._loadingFields$.next(true);
    this._fieldsSubscription?.unsubscribe();
    this._fieldsSubscription = this.processLinkBuildingBlockApiService
      .getFieldsForBuildingBlock(key, versionTag)
      .subscribe({
        next: fields => {
          this._buildingBlockFields$.next(
            (fields ?? []).map(field => ({...field, name: ensureDocPrefix(field.name)}))
          );
          this._loadingFields$.next(false);
        },
        error: () => {
          this._buildingBlockFields$.next([]);
          this._loadingFields$.next(false);
        },
      });
  }

  private clearPluginRequirements(options: {preserveMappings?: boolean} = {}): void {
    this._requirementsSubscription?.unsubscribe();
    this._requiredPluginKeys$.next([]);
    if (!options.preserveMappings) {
      this._pluginMappings$.next({});
    }
    this._loadingRequirements$.next(false);
  }

  private clearFields(): void {
    this._fieldsSubscription?.unsubscribe();
    this._buildingBlockFields$.next([]);
    this._loadingFields$.next(false);
  }

  private clearMappings(options: {preserveMappings?: boolean} = {}): void {
    if (options.preserveMappings) {
      return;
    }
    this._inputMappings$.next([]);
    this._outputMappings$.next([]);
  }
}
