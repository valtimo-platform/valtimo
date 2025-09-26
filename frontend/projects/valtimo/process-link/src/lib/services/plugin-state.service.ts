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

import {Injectable} from '@angular/core';
import {BehaviorSubject, combineLatest, Observable, of, Subject, switchMap} from 'rxjs';
import {map} from 'rxjs/operators';
import {
  PluginConfiguration,
  PluginDefinition,
  PluginFunction,
  PluginManagementService,
  PluginService,
} from '@valtimo/plugin';
import {ProcessLink} from '../models';

@Injectable({
  providedIn: 'root',
})
export class PluginStateService {
  private readonly _selectedPluginDefinition$ = new BehaviorSubject<PluginDefinition>(undefined);
  private readonly _selectedPluginConfiguration$ = new BehaviorSubject<PluginConfiguration>(
    undefined
  );
  private readonly _selectedPluginFunction$ = new BehaviorSubject<PluginFunction>(undefined);
  private readonly _save$ = new Subject<null>();
  private readonly _selectedProcessLink$ = new BehaviorSubject<ProcessLink>(undefined);

  constructor(
    private readonly pluginManagementService: PluginManagementService,
    private readonly pluginService: PluginService
  ) {}

  get selectedPluginDefinition$(): Observable<PluginDefinition> {
    return this._selectedPluginDefinition$.asObservable();
  }

  get selectedPluginConfiguration$(): Observable<PluginConfiguration> {
    return this._selectedPluginConfiguration$.asObservable();
  }

  get selectedPluginFunction$(): Observable<PluginFunction> {
    return this._selectedPluginFunction$.asObservable();
  }

  get save$(): Observable<any> {
    return this._save$.asObservable();
  }

  get functionKey$(): Observable<string> {
    return this._selectedProcessLink$.pipe(
      switchMap(processLink =>
        !processLink
          ? this._selectedPluginFunction$.pipe(map(pluginFunction => pluginFunction?.key))
          : of(processLink?.pluginActionDefinitionKey)
      )
    );
  }

  get pluginDefinitionKey$(): Observable<string> {
    return this._selectedProcessLink$.pipe(
      switchMap(selectedProcesLink =>
        !selectedProcesLink
          ? this._selectedPluginConfiguration$.pipe(
              map(configuration => configuration?.pluginDefinition.key)
            )
          : combineLatest([
              this._selectedProcessLink$,
              this.pluginService.pluginSpecifications$,
            ]).pipe(
              map(([processLink, pluginSpecifications]) => {
                const pluginSpecification = pluginSpecifications.find(specification => {
                  const functionKeys =
                    specification?.functionConfigurationComponents &&
                    Object.keys(specification.functionConfigurationComponents);
                  return functionKeys?.includes(processLink?.pluginActionDefinitionKey);
                });

                return pluginSpecification?.pluginId;
              })
            )
      )
    );
  }

  selectPluginDefinition(definition: PluginDefinition): void {
    this._selectedPluginDefinition$.next(definition);
  }

  selectPluginConfiguration(configuration: PluginConfiguration): void {
    this._selectedPluginConfiguration$.next(configuration);
  }

  selectPluginFunction(pluginFunction: PluginFunction): void {
    this._selectedPluginFunction$.next(pluginFunction);
  }

  selectProcessLink(processLink: ProcessLink): void {
    this._selectedProcessLink$.next(processLink);
  }

  deselectProcessLink(): void {
    this._selectedProcessLink$.next(undefined);
  }

  save(): void {
    this._save$.next(null);
  }
}
