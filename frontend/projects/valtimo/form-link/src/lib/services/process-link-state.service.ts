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
import {BehaviorSubject, combineLatest, Observable, Subject, switchMap} from 'rxjs';
import {
  PluginConfiguration,
  PluginDefinition,
  PluginFunction,
  PluginConfigurationWithLogo,
  PluginManagementService,
} from '@valtimo/plugin-management';
import {map} from 'rxjs/operators';
import {PluginService, PluginSpecification} from '@valtimo/plugin';
import {ProcessLink, ProcessLinkModalType} from '../models';

@Injectable({
  providedIn: 'root',
})
export class ProcessLinkStateService {
  private readonly _selectedPluginDefinition$ = new BehaviorSubject<PluginDefinition>(undefined);
  private readonly _selectedPluginConfiguration$ = new BehaviorSubject<PluginConfiguration>(
    undefined
  );
  private readonly _selectedPluginFunction$ = new BehaviorSubject<PluginFunction>(undefined);
  private readonly _selectedProcessLink$ = new BehaviorSubject<ProcessLink>(undefined);
  private readonly _inputDisabled$ = new BehaviorSubject<boolean>(false);
  private readonly _save$ = new Subject<null>();
  private readonly _saveModify$ = new Subject<null>();
  private readonly _modalType$ = new BehaviorSubject<ProcessLinkModalType>('create');

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

  get inputDisabled$(): Observable<boolean> {
    return this._inputDisabled$.asObservable();
  }

  get isCreateModal$(): Observable<boolean> {
    return this._modalType$.pipe(map(modalType => modalType === 'create'));
  }

  get isEditModal$(): Observable<boolean> {
    return this._modalType$.pipe(map(modalType => modalType === 'edit'));
  }

  get save$(): Observable<any> {
    return this.isCreateModal$.pipe(
      switchMap(isCreateModal =>
        isCreateModal ? this._save$.asObservable() : this._saveModify$.asObservable()
      )
    );
  }

  get selectedProcessLink$(): Observable<ProcessLink> {
    return this._selectedProcessLink$.asObservable();
  }

  get modalType$(): Observable<ProcessLinkModalType> {
    return this._modalType$.asObservable();
  }

  get functionKey$(): Observable<string> {
    return this.isCreateModal$.pipe(
      switchMap(isCreateModal =>
        isCreateModal
          ? this._selectedPluginFunction$.pipe(map(pluginFunction => pluginFunction?.key))
          : this._selectedProcessLink$.pipe(
              map(processLink => processLink?.pluginActionDefinitionKey)
            )
      )
    );
  }

  get pluginDefinitionKey$(): Observable<string> {
    return this.isCreateModal$.pipe(
      switchMap(isCreateModal =>
        isCreateModal
          ? this._selectedPluginConfiguration$.pipe(
              map(configuration => configuration?.pluginDefinition.key)
            )
          : combineLatest([
              this._selectedProcessLink$,
              this.pluginService.pluginSpecifications$,
            ]).pipe(
              map(([processLink, pluginSpecifications]) => {
                const pluginSpecification = pluginSpecifications.find(specification => {
                  const functionKeys = Object.keys(specification.functionConfigurationComponents);
                  return functionKeys.includes(processLink?.pluginActionDefinitionKey);
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

  deselectPluginDefinition(): void {
    this._selectedPluginDefinition$.next(undefined);
  }

  deselectPluginConfiguration(): void {
    this._selectedPluginConfiguration$.next(undefined);
  }

  deselectPluginFunction(): void {
    this._selectedPluginFunction$.next(undefined);
  }

  deselectProcessLink(): void {
    this._selectedProcessLink$.next(undefined);
  }

  disableInput(): void {
    this._inputDisabled$.next(true);
  }

  enableInput(): void {
    this._inputDisabled$.next(false);
  }

  save(): void {
    this._save$.next(null);
  }

  saveModify(): void {
    this._saveModify$.next(null);
  }

  setModalType(type: ProcessLinkModalType): void {
    this._modalType$.next(type);
  }

  clear(): void {
    this.deselectPluginDefinition();
    this.deselectPluginConfiguration();
    this.deselectPluginFunction();
    this.deselectProcessLink();
  }
}
