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
import {BehaviorSubject, combineLatest, Observable, Subject} from 'rxjs';
import {map, take} from 'rxjs/operators';
import {PluginModal} from '../models';
import {
  PluginService,
  PluginSpecification,
  PluginConfiguration,
  PluginDefinition,
  PluginDefinitionWithLogo,
} from '@valtimo/plugin';
import {DomSanitizer} from '@angular/platform-browser';

@Injectable({
  providedIn: 'root',
})
export class PluginManagementStateService {
  private readonly _showModal$ = new Subject<PluginModal>();
  private readonly _hideModal$ = new Subject();
  private readonly _inputDisabled$ = new BehaviorSubject<boolean>(false);
  private readonly _refresh$ = new BehaviorSubject<null>(null);
  private readonly _save$ = new Subject<null>();
  private readonly _saveEdit$ = new Subject<null>();
  private readonly _delete$ = new Subject<null>();
  private readonly _hideModalSaveButton$ = new BehaviorSubject<boolean>(false);
  private readonly _pluginDefinitions$ = new BehaviorSubject<Array<PluginDefinition> | undefined>(
    undefined
  );
  private readonly _pluginDefinitionsWithLogos$: Observable<
    Array<PluginDefinitionWithLogo> | undefined
  > = combineLatest([
    this._pluginDefinitions$,
    this.pluginService.pluginSpecifications$,
    this.pluginService.availablePluginIds$,
  ]).pipe(
    map(([pluginDefinitions, pluginSpecifications, availablePluginIds]) =>
      pluginDefinitions
        ?.filter(pluginDefinition => availablePluginIds.includes(pluginDefinition.key))
        .map(pluginDefinition => {
          const pluginSpecification = pluginSpecifications.find(
            specification => specification.pluginId === pluginDefinition.key
          );

          return {
            ...pluginDefinition,
            ...(pluginSpecification?.pluginLogoBase64 && {
              pluginLogoBase64: this.sanitizer.bypassSecurityTrustResourceUrl(
                pluginSpecification?.pluginLogoBase64
              ),
            }),
          };
        })
    )
  );
  private readonly _selectedPluginDefinition$ = new BehaviorSubject<PluginDefinition | undefined>(
    undefined
  );

  private readonly _selectedPluginConfiguration$ = new BehaviorSubject<
    PluginConfiguration | undefined
  >(undefined);

  constructor(
    private readonly pluginService: PluginService,
    private readonly sanitizer: DomSanitizer
  ) {}

  get showModal$(): Observable<PluginModal> {
    return this._showModal$.asObservable();
  }

  get hideModal$(): Observable<any> {
    return this._hideModal$.asObservable();
  }

  get inputDisabled$(): Observable<boolean> {
    return this._inputDisabled$.asObservable();
  }

  get refresh$(): Observable<any> {
    return this._refresh$.asObservable();
  }

  get pluginDefinitions$(): Observable<Array<PluginDefinition> | undefined> {
    return this._pluginDefinitions$.asObservable();
  }

  get pluginDefinitionsWithLogos$(): Observable<Array<PluginDefinitionWithLogo> | undefined> {
    return this._pluginDefinitionsWithLogos$;
  }

  get selectedPluginDefinition$(): Observable<PluginDefinition | undefined> {
    return this._selectedPluginDefinition$.asObservable();
  }

  get selectedPluginConfiguration$(): Observable<PluginConfiguration | undefined> {
    return this._selectedPluginConfiguration$.asObservable();
  }

  get save$(): Observable<any> {
    return this._save$.asObservable();
  }

  get saveEdit$(): Observable<any> {
    return this._saveEdit$.asObservable();
  }

  get delete$(): Observable<any> {
    return this._delete$.asObservable();
  }

  get hideModalSaveButton$(): Observable<boolean> {
    return this._hideModalSaveButton$.asObservable();
  }

  showModal(modalType: PluginModal): void {
    this._showModal$.next(modalType);
  }

  hideModal(): void {
    this._hideModal$.next(null);
  }

  disableInput(): void {
    this._inputDisabled$.next(true);
  }

  enableInput(): void {
    this._inputDisabled$.next(false);
  }

  refresh(): void {
    this._refresh$.next(null);
  }

  setPluginDefinitions(definitions: Array<PluginDefinition>): void {
    this._pluginDefinitions$.next(definitions);
  }

  selectPluginDefinition(definition: PluginDefinition): void {
    this._selectedPluginDefinition$.next(definition);
  }

  selectPluginConfiguration(configuration: PluginConfiguration): void {
    this._selectedPluginConfiguration$.next(configuration);
  }

  clearSelectedPluginDefinition(): void {
    this._selectedPluginDefinition$.next(undefined);
  }

  clearSelectedPluginConfiguration(): void {
    this._selectedPluginConfiguration$.next(undefined);
  }

  save(): void {
    this._save$.next(null);
  }

  saveEdit(): void {
    this._saveEdit$.next(null);
  }

  delete(): void {
    this._delete$.next(null);
  }

  hideModalSaveButton(): void {
    this._hideModalSaveButton$.next(true);
  }

  showModalSaveButton(): void {
    this._hideModalSaveButton$.next(false);
  }

  clear(): void {
    this.clearSelectedPluginDefinition();
    this.clearSelectedPluginConfiguration();
  }
}
