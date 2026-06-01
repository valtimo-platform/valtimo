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
import {Component, OnDestroy} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {ActionItem, ColumnConfig, ViewType} from '@valtimo/components';
import {
  ExternalPluginConfiguration,
  ExternalPluginDefinition,
  ExternalPluginHost,
  ExternalPluginHostCreateRequest,
  ExternalPluginService,
  PluginConfiguration,
  PluginManagementService,
  PluginTranslationService,
} from '@valtimo/plugin';
import {NGXLogger} from 'ngx-logger';
import {BehaviorSubject, combineLatest, EMPTY, fromEvent, merge, Observable, of, Subject, timer} from 'rxjs';
import {catchError, map, startWith, switchMap, take, takeUntil, tap} from 'rxjs/operators';
import {PluginManagementStateService} from '../../services';
import {UnifiedPluginConfigurationRow} from '../../models';
import {cloneDeep} from 'lodash';
import {v4 as uuidv4} from 'uuid';

@Component({
  standalone: false,
  selector: 'valtimo-plugin-management',
  templateUrl: './plugin-management.component.html',
  styleUrls: ['./plugin-management.component.scss'],
})
export class PluginManagementComponent implements OnDestroy {
  private readonly _destroy$ = new Subject<void>();
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
      key: 'sourceLabel',
      label: 'pluginManagement.labels.source',
      viewType: ViewType.TAGS,
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
      disabledCallback: (row: UnifiedPluginConfigurationRow) => row.source === 'external',
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
  public readonly pluginConfigurations$: Observable<Array<UnifiedPluginConfigurationRow>> =
    this._stateService.refresh$.pipe(
      switchMap(() =>
        combineLatest([
          this._pluginManagementService.getAllPluginConfigurations(),
          this._externalPluginService
            .getConfigurations()
            .pipe(catchError(() => of([] as ExternalPluginConfiguration[]))),
          this._externalPluginService
            .getDefinitions()
            .pipe(catchError(() => of([] as ExternalPluginDefinition[]))),
          this._translateService.stream('key'),
        ]).pipe(
          map(([pluginConfigurations, externalConfigurations, externalDefinitions]) => {
            const embedded: UnifiedPluginConfigurationRow[] = pluginConfigurations.map(
              configuration => ({
                id: configuration.id,
                title: configuration.title,
                pluginName: this._pluginTranslationService.instant(
                  'title',
                  configuration.pluginDefinition?.key ?? ''
                ),
                definitionKey: configuration.pluginDefinition?.key ?? '',
                source: 'embedded',
                sourceLabel: this._translateService.instant('pluginManagement.source.embedded'),
                pluginDefinition: configuration.pluginDefinition,
                properties: configuration.properties,
              })
            );

            const external: UnifiedPluginConfigurationRow[] = externalConfigurations.map(config => {
              const definition = externalDefinitions.find(d => d.id === config.definitionId);
              return {
                id: config.id,
                title: config.title,
                pluginName: definition?.name ?? definition?.pluginId ?? '',
                definitionKey: definition?.pluginId ?? '',
                source: 'external',
                sourceLabel: this._translateService.instant('pluginManagement.source.external'),
                externalDefinitionId: config.definitionId,
              };
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

  // --- External plugin edit modal ---
  public readonly showExternalEditModal$ = new BehaviorSubject<boolean>(false);
  public readonly selectedExternalConfiguration$ =
    new BehaviorSubject<UnifiedPluginConfigurationRow | null>(null);

  // --- Plugin hosts tab ---
  public readonly hostsLoading$ = new BehaviorSubject<boolean>(true);
  public readonly hostModalOpen$ = new BehaviorSubject<boolean>(false);

  private readonly _refreshHosts$ = new Subject<void>();

  private readonly _tabVisible$: Observable<boolean> = fromEvent(document, 'visibilitychange').pipe(
    startWith(null),
    map(() => document.visibilityState === 'visible')
  );

  public readonly hosts$: Observable<Array<ExternalPluginHost>> = merge(
    this._tabVisible$.pipe(
      switchMap(visible => (visible ? timer(0, 5000) : EMPTY))
    ),
    this._refreshHosts$
  ).pipe(
    takeUntil(this._destroy$),
    switchMap(() =>
      this._externalPluginService.getHosts().pipe(catchError(() => of([] as ExternalPluginHost[])))
    ),
    tap(() => this.hostsLoading$.next(false))
  );

  constructor(
    private readonly _logger: NGXLogger,
    private readonly _pluginManagementService: PluginManagementService,
    private readonly _pluginTranslationService: PluginTranslationService,
    private readonly _stateService: PluginManagementStateService,
    private readonly _translateService: TranslateService,
    private readonly _externalPluginService: ExternalPluginService
  ) {}

  public ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  // --- Configurations tab methods ---

  public showAddModal(): void {
    this.showAddModal$.next(true);
  }

  public editConfiguration(configuration: UnifiedPluginConfigurationRow): void {
    if (configuration.source === 'external') {
      this.selectedExternalConfiguration$.next(configuration);
      this.showExternalEditModal$.next(true);
      return;
    }

    this.showEditModal$.next(true);
    this.saveNewConfiguration$.next(false);
    this._stateService.selectPluginConfiguration(configuration as unknown as PluginConfiguration);
  }

  public deleteConfiguration(configuration: UnifiedPluginConfigurationRow): void {
    if (!configuration.id) return;

    if (configuration.source === 'external') {
      this._externalPluginService
        .deleteConfiguration(configuration.id)
        .pipe(take(1))
        .subscribe({
          next: () => {
            this._stateService.refresh();
          },
          error: () => {
            this._logger.error(
              'Something went wrong with deleting the external plugin configuration.'
            );
          },
        });
    } else {
      this._pluginManagementService
        .deletePluginConfiguration(configuration.id)
        .pipe(take(1))
        .subscribe({
          next: () => {
            this._stateService.refresh();
          },
          error: () => {
            this._logger.error('Something went wrong with deleting the plugin configuration.');
          },
        });
    }
  }

  public closeEditModal(): void {
    this.showEditModal$.next(false);
  }

  public closeAddModal(): void {
    this.showAddModal$.next(false);
  }

  public duplicateConfiguration(configuration: UnifiedPluginConfigurationRow): void {
    if (configuration.source === 'external') return;

    const configurationClone = cloneDeep(configuration);
    configurationClone.id = uuidv4();
    this.showEditModal$.next(true);
    this.saveNewConfiguration$.next(true);
    this._stateService.selectPluginConfiguration(
      configurationClone as unknown as PluginConfiguration
    );
  }

  // --- External plugin edit modal methods ---

  public closeExternalEditModal(): void {
    this.showExternalEditModal$.next(false);
    this.selectedExternalConfiguration$.next(null);
  }

  public onExternalConfigSaved(): void {
    this.showExternalEditModal$.next(false);
    this.selectedExternalConfiguration$.next(null);
    this._stateService.refresh();
  }

  public onExternalConfigDeleted(configurationId: string): void {
    this._externalPluginService.deleteConfiguration(configurationId).subscribe({
      next: () => {
        this.showExternalEditModal$.next(false);
        this.selectedExternalConfiguration$.next(null);
        this._stateService.refresh();
      },
      error: () => {
        this._logger.error(
          'Something went wrong with deleting the external plugin configuration.'
        );
      },
    });
  }

  // --- Plugin upload modal ---
  public readonly uploadModalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly connectedHosts$: Observable<Array<ExternalPluginHost>> = this.hosts$.pipe(
    map(hosts => hosts.filter(h => h.status === 'CONNECTED'))
  );
  public readonly hasConnectedHosts$: Observable<boolean> = this.connectedHosts$.pipe(
    map(hosts => hosts.length > 0)
  );

  public openUploadModal(): void {
    this.uploadModalOpen$.next(true);
  }

  public closeUploadModal(): void {
    this.uploadModalOpen$.next(false);
  }

  public onPluginUploaded(): void {
    this.uploadModalOpen$.next(false);
    this._stateService.refresh();
  }

  // --- Plugin hosts tab methods ---

  public openHostModal(): void {
    this.hostModalOpen$.next(true);
  }

  public closeHostModal(): void {
    this.hostModalOpen$.next(false);
  }

  public submitHost(request: ExternalPluginHostCreateRequest): void {
    this._externalPluginService.createHost(request).subscribe({
      next: () => {
        this.hostModalOpen$.next(false);
        this.hostsLoading$.next(true);
        this._refreshHosts$.next();
      },
      error: () => {
        this._logger.error('Something went wrong with creating the plugin host.');
      },
    });
  }
}
