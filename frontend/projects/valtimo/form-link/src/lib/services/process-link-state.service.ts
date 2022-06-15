/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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
import {BehaviorSubject, combineLatest, Observable, Subject} from 'rxjs';
import {
  PluginConfiguration,
  PluginDefinition,
  PluginFunction,
  PluginConfigurationWithLogo,
  PluginManagementService,
} from '@valtimo/plugin-management';
import {map} from 'rxjs/operators';
import {PluginService, PluginSpecification} from '@valtimo/plugin';

@Injectable({
  providedIn: 'root',
})
export class ProcessLinkStateService {
  private readonly _selectedPluginDefinition$ = new BehaviorSubject<PluginDefinition>(undefined);
  private readonly _selectedPluginConfiguration$ = new BehaviorSubject<PluginConfiguration>(
    undefined
  );
  private readonly _selectedPluginFunction$ = new BehaviorSubject<PluginFunction>(undefined);
  private readonly _selectedPluginSpecification$: Observable<PluginSpecification | null> =
    combineLatest([
      this.pluginService.pluginSpecifications$,
      this._selectedPluginConfiguration$,
    ]).pipe(
      map(([pluginSpecifications, selectedPluginConfiguration]) => {
        const selectedPluginSpecification = pluginSpecifications?.find(
          specification => specification.pluginId === selectedPluginConfiguration?.definitionKey
        );

        return selectedPluginSpecification || null;
      })
    );

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

  get selectedPluginSpecification$(): Observable<PluginSpecification | null> {
    return this._selectedPluginSpecification$;
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

  deselectPluginDefinition(): void {
    this._selectedPluginDefinition$.next(undefined);
  }

  deselectPluginConfiguration(): void {
    this._selectedPluginConfiguration$.next(undefined);
  }

  deselectPluginFunction(): void {
    this._selectedPluginFunction$.next(undefined);
  }

  clear(): void {
    this.deselectPluginDefinition();
    this.deselectPluginConfiguration();
    this.deselectPluginFunction();
  }
}
