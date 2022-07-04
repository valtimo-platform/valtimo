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

import {Component} from '@angular/core';
import {BehaviorSubject, combineLatest} from 'rxjs';
import {TableColumn} from '@valtimo/user-interface';
import {PluginManagementStateService, PluginManagementService} from '../../services';
import {TranslateService} from '@ngx-translate/core';
import {map, switchMap, tap} from 'rxjs/operators';
import {PluginTranslationService} from '@valtimo/plugin';

@Component({
  selector: 'valtimo-plugin-management',
  templateUrl: './plugin-management.component.html',
  styleUrls: ['./plugin-management.component.scss'],
})
export class PluginManagementComponent {
  readonly loading$ = new BehaviorSubject<boolean>(true);

  readonly columns$ = new BehaviorSubject<Array<TableColumn>>([
    {
      labelTranslationKey: 'pluginManagement.labels.pluginName',
      dataKey: 'pluginName',
    },
    {
      labelTranslationKey: 'pluginManagement.labels.identifier',
      dataKey: 'definitionKey',
    },
    {
      labelTranslationKey: 'pluginManagement.labels.configurationName',
      dataKey: 'title',
    },
  ]);

  readonly pluginConfigurations$ = this.stateService.refresh$.pipe(
    switchMap(() =>
      combineLatest([
        this.pluginManagementService.getAllPluginConfigurations(),
        this.translateService.stream('key'),
      ]).pipe(
        map(([pluginConfigurations]) =>
          pluginConfigurations.map(configuration => ({
            ...configuration,
            pluginName: this.pluginTranslationService.instant(
              'title',
              configuration.pluginDefinition.key
            ),
            definitionKey: configuration.pluginDefinition.key,
          }))
        ),
        tap(() => {
          this.loading$.next(false);
        })
      )
    )
  );

  constructor(
    private readonly pluginManagementService: PluginManagementService,
    private readonly translateService: TranslateService,
    private readonly stateService: PluginManagementStateService,
    private readonly pluginTranslationService: PluginTranslationService
  ) {}

  showAddModal(): void {
    this.stateService.showModal('add');
  }
}
