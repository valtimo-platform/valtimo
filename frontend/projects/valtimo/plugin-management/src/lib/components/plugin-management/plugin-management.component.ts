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
import {Component} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {ActionItem, ColumnConfig, ViewType} from '@valtimo/components';
import {
  PluginConfiguration,
  PluginManagementService,
  PluginTranslationService,
} from '@valtimo/plugin';
import {NGXLogger} from 'ngx-logger';
import {BehaviorSubject, combineLatest} from 'rxjs';
import {map, switchMap, take, tap} from 'rxjs/operators';
import {PluginManagementStateService} from '../../services';

@Component({
  selector: 'valtimo-plugin-management',
  templateUrl: './plugin-management.component.html',
  styleUrls: ['./plugin-management.component.scss'],
})
export class PluginManagementComponent {
  public readonly fields: ColumnConfig[] = [
    {
      key: 'pluginName',
      label: 'pluginManagement.labels.pluginName',
      viewType: ViewType.TEXT,
    },
    {
      key: 'definitionKey',
      label: 'pluginManagement.labels.identifier',
      viewType: ViewType.TEXT,
    },
    {
      key: 'title',
      label: 'pluginManagement.labels.configurationName',
      viewType: ViewType.TEXT,
    },
  ];
  public readonly actionItems: ActionItem[] = [
    {
      callback: this.editConfiguration.bind(this),
      label: 'interface.edit',
    },
    {
      callback: this.deleteConfiguration.bind(this),
      label: 'interface.delete',
      type: 'danger',
    },
  ];

  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly pluginConfigurations$ = this.stateService.refresh$.pipe(
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
              configuration.pluginDefinition?.key ?? ''
            ),
            definitionKey: configuration.pluginDefinition?.key ?? '',
          }))
        ),
        tap(() => {
          this.loading$.next(false);
        })
      )
    )
  );
  constructor(
    private readonly logger: NGXLogger,
    private readonly pluginManagementService: PluginManagementService,
    private readonly pluginTranslationService: PluginTranslationService,
    private readonly stateService: PluginManagementStateService,
    private readonly translateService: TranslateService
  ) {}

  public showAddModal(): void {
    this.stateService.showModal('add');
  }

  public editConfiguration(configuration: PluginConfiguration): void {
    this.stateService.selectPluginConfiguration(configuration);
    this.stateService.showModal('edit');
  }

  public deleteConfiguration(configuration: PluginConfiguration): void {
    if (!configuration.id) {
      return;
    }

    this.pluginManagementService
      .deletePluginConfiguration(configuration.id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.stateService.refresh();
        },
        error: () => {
          this.logger.error('Something went wrong with deleting the plugin configuration.');
        },
      });
  }
}
