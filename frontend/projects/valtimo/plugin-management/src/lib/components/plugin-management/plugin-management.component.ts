/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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
import {Component, signal} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {ActionItem, ColumnConfig, ViewType} from '@valtimo/components';
import {
  PluginConfiguration,
  PluginManagementService,
  PluginTranslationService,
} from '@valtimo/plugin';
import {NGXLogger} from 'ngx-logger';
import {BehaviorSubject, combineLatest, Observable, of} from 'rxjs';
import {catchError, map, switchMap, take, tap} from 'rxjs/operators';
import {ExternalPluginService, PluginManagementStateService} from '../../services';
import {
  ExternalPluginConfiguration,
  ExternalPluginDefinition,
  ExternalPluginHost,
  ExternalPluginHostCreateRequest,
} from '../../models';
import {cloneDeep} from 'lodash';
import {v4 as uuidv4} from 'uuid';

@Component({
  standalone: false,
  selector: 'valtimo-plugin-management',
  templateUrl: './plugin-management.component.html',
  styleUrls: ['./plugin-management.component.scss'],
})
export class PluginManagementComponent {
  // --- Configurations tab ---
  public readonly fields: ColumnConfig[] = [
    {
      key: 'title',
      label: 'pluginManagement.labels.configurationName',
      viewType: ViewType.TEXT,
    },
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
      key: 'sourceTag',
      label: 'pluginManagement.labels.source',
      viewType: ViewType.TEXT,
    },
  ];

  public readonly actionItems: ActionItem[] = [
    {
      callback: this.editConfiguration.bind(this),
      label: 'interface.edit',
    },
    {
      label: 'interface.duplicate',
      callback: this.duplicateConfiguration.bind(this),
    },
    {
      callback: this.deleteConfiguration.bind(this),
      label: 'interface.delete',
      type: 'danger',
    },
  ];

  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly showEditModal$ = new BehaviorSubject<boolean>(false);
  public readonly showAddModal$ = new BehaviorSubject<boolean>(false);
  public readonly pluginConfigurations$: Observable<Array<PluginConfiguration & {pluginName: string; definitionKey: string; sourceTag: string}>> =
    this.stateService.refresh$.pipe(
      switchMap(() =>
        combineLatest([
          this.pluginManagementService.getAllPluginConfigurations(),
          this.externalPluginService.getConfigurations().pipe(catchError(() => of([] as ExternalPluginConfiguration[]))),
          this.externalPluginService.getDefinitions().pipe(catchError(() => of([] as ExternalPluginDefinition[]))),
          this.translateService.stream('key'),
        ]).pipe(
          map(([pluginConfigurations, externalConfigurations, externalDefinitions]) => {
            const embedded = pluginConfigurations.map(configuration => ({
              ...configuration,
              pluginName: this.pluginTranslationService.instant(
                'title',
                configuration.pluginDefinition?.key ?? ''
              ),
              definitionKey: configuration.pluginDefinition?.key ?? '',
              sourceTag: 'Ingebed',
            }));

            const external = externalConfigurations.map(config => {
              const definition = externalDefinitions.find(d => d.id === config.definitionId);
              return {
                id: config.id,
                title: config.title,
                pluginName: definition?.name ?? definition?.pluginId ?? '',
                definitionKey: definition?.pluginId ?? '',
                sourceTag: 'Extern',
              } as PluginConfiguration & {pluginName: string; definitionKey: string; sourceTag: string};
            });

            return [...embedded, ...external];
          }),
          tap(() => {
            this.loading$.next(false);
          })
        )
      )
    );

  public readonly saveNewConfiguration$ = new BehaviorSubject<boolean>(false);

  // --- Plugin hosts tab ---
  public readonly hostFields: ColumnConfig[] = [
    {
      key: 'name',
      label: 'pluginManagement.labels.name',
      viewType: ViewType.TEXT,
    },
    {
      key: 'baseUrl',
      label: 'pluginManagement.labels.baseUrl',
      viewType: ViewType.TEXT,
    },
    {
      key: 'status',
      label: 'pluginManagement.labels.status',
      viewType: ViewType.TEXT,
    },
    {
      key: 'lastHealthCheck',
      label: 'pluginManagement.labels.lastHealthCheck',
      viewType: ViewType.TEXT,
    },
  ];

  public readonly $hostsLoading = signal(true);
  public readonly $hostModalOpen = signal(false);

  private readonly _refreshHosts$ = new BehaviorSubject<void>(undefined);

  public readonly hosts$: Observable<Array<ExternalPluginHost>> = this._refreshHosts$.pipe(
    switchMap(() => this.externalPluginService.getHosts()),
    tap(() => this.$hostsLoading.set(false)),
  );

  constructor(
    private readonly logger: NGXLogger,
    private readonly pluginManagementService: PluginManagementService,
    private readonly pluginTranslationService: PluginTranslationService,
    private readonly stateService: PluginManagementStateService,
    private readonly translateService: TranslateService,
    private readonly externalPluginService: ExternalPluginService
  ) {}

  // --- Configurations tab methods ---

  public showAddModal(): void {
    this.showAddModal$.next(true);
  }

  public editConfiguration(configuration: PluginConfiguration): void {
    this.showEditModal$.next(true);
    this.saveNewConfiguration$.next(false);
    this.stateService.selectPluginConfiguration(configuration);
  }

  public deleteConfiguration(configuration: PluginConfiguration): void {
    if (!configuration.id) return;

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

  public closeEditModal(): void {
    this.showEditModal$.next(false);
  }

  public closeAddModal(): void {
    this.showAddModal$.next(false);
  }

  public duplicateConfiguration(configuration: PluginConfiguration): void {
    const configurationClone = cloneDeep(configuration);
    configurationClone.id = uuidv4();
    this.showEditModal$.next(true);
    this.saveNewConfiguration$.next(true);
    this.stateService.selectPluginConfiguration(configurationClone);
  }

  // --- Plugin hosts tab methods ---

  public openHostModal(): void {
    this.$hostModalOpen.set(true);
  }

  public closeHostModal(): void {
    this.$hostModalOpen.set(false);
  }

  public submitHost(request: ExternalPluginHostCreateRequest): void {
    this.externalPluginService.createHost(request).subscribe({
      next: () => {
        this.$hostModalOpen.set(false);
        this.$hostsLoading.set(true);
        this._refreshHosts$.next();
      },
      error: () => {
        this.logger.error('Something went wrong with creating the plugin host.');
      },
    });
  }
}
