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
import {AfterViewInit, Component, OnDestroy, TemplateRef, ViewChild} from '@angular/core';
import {HttpErrorResponse} from '@angular/common/http';
import {TranslateService} from '@ngx-translate/core';
import {ActionItem, ColumnConfig, ViewType} from '@valtimo/components';
import {
  ExternalPluginConfiguration,
  ExternalPluginDefinition,
  ExternalPluginHost,
  ExternalPluginHostUsage,
  ExternalPluginService,
  getExternalPluginDisplayName,
  isExternalPluginDefinitionIncompatible,
  PluginConfiguration,
  PluginManagementService,
  PluginTranslationService,
} from '@valtimo/plugin';
import {IconService} from 'carbon-components-angular';
import {Information16, Upload16} from '@carbon/icons';
import {buildExternalPluginCompatibilityMessage} from '../../utils';
import {NGXLogger} from 'ngx-logger';
import {
  BehaviorSubject,
  combineLatest,
  EMPTY,
  fromEvent,
  merge,
  Observable,
  of,
  Subject,
  timer,
} from 'rxjs';
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
export class PluginManagementComponent implements AfterViewInit, OnDestroy {
  private readonly _destroy$ = new Subject<void>();

  @ViewChild('pluginNameColumnTemplate') private _pluginNameColumnTemplate!: TemplateRef<any>;

  // --- Configurations ---
  public readonly fields$ = new BehaviorSubject<ColumnConfig[]>([]);

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
          this._allHosts$,
          this._translateService.stream('key'),
        ]).pipe(
          map(([pluginConfigurations, externalConfigurations, externalDefinitions, hosts]) => {
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

            const lang = this._translateService.currentLang;
            const external: UnifiedPluginConfigurationRow[] = externalConfigurations.map(config => {
              const definition = externalDefinitions.find(d => d.id === config.definitionId);
              const incompatible = isExternalPluginDefinitionIncompatible(definition);
              const host = definition
                ? hosts.find(h => h.id === definition.hostId)
                : undefined;
              return {
                id: config.id,
                title: config.title,
                pluginName: definition ? getExternalPluginDisplayName(definition, lang) : '',
                definitionKey: definition?.pluginId ?? '',
                source: 'external',
                sourceLabel: this._translateService.instant('pluginManagement.source.external'),
                externalDefinitionId: config.definitionId,
                incompatible,
                compatibilityMessage:
                  incompatible && definition
                    ? buildExternalPluginCompatibilityMessage(definition, this._translateService)
                    : undefined,
                hostName: host?.name,
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

  // --- External plugin edit modal ---
  public readonly showExternalEditModal$ = new BehaviorSubject<boolean>(false);
  public readonly selectedExternalConfiguration$ =
    new BehaviorSubject<UnifiedPluginConfigurationRow | null>(null);

  // --- Delete configuration ---
  public readonly deleteConfigurationModalOpen$ = new BehaviorSubject<boolean>(false);
  public configurationToDelete: {
    id: string;
    title: string;
    source: 'external' | 'embedded';
  } | null = null;

  public readonly usageModalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly usageModalUsages$ = new BehaviorSubject<Array<ExternalPluginHostUsage>>([]);
  public usageModalEntityName: string | null = null;
  public usageModalTitleKey = '';
  public usageModalDescriptionKey = '';

  // --- External plugin definitions refresh ---
  public readonly externalDefsRefreshing$ = new BehaviorSubject<boolean>(false);
  private _externalDefsInitialLoad = true;

  private readonly _tabVisible$: Observable<boolean> = fromEvent(document, 'visibilitychange').pipe(
    startWith(null),
    map(() => document.visibilityState === 'visible')
  );

  public readonly externalDefinitions$: Observable<ExternalPluginDefinition[]> = merge(
    this._tabVisible$.pipe(switchMap(visible => (visible ? timer(0, 5000) : EMPTY))),
    this._stateService.refresh$
  ).pipe(
    takeUntil(this._destroy$),
    tap(() => {
      if (!this._externalDefsInitialLoad) {
        this.externalDefsRefreshing$.next(true);
      }
    }),
    switchMap(() =>
      this._externalPluginService
        .getDefinitions()
        .pipe(catchError(() => of([] as ExternalPluginDefinition[])))
    ),
    tap(() => {
      this._externalDefsInitialLoad = false;
      this.externalDefsRefreshing$.next(false);
    })
  );

  // --- Plugin upload ---
  public readonly uploadModalOpen$ = new BehaviorSubject<boolean>(false);

  private readonly _refreshHosts$ = new Subject<void>();
  private _hostsInitialLoad = true;

  private readonly _allHosts$: Observable<ExternalPluginHost[]> = merge(
    this._tabVisible$.pipe(switchMap(visible => (visible ? timer(0, 5000) : EMPTY))),
    this._refreshHosts$
  ).pipe(
    takeUntil(this._destroy$),
    switchMap(() =>
      this._externalPluginService.getHosts().pipe(catchError(() => of([] as ExternalPluginHost[])))
    ),
    tap(() => {
      this._hostsInitialLoad = false;
    })
  );

  public readonly connectedHosts$: Observable<Array<ExternalPluginHost>> = this._allHosts$.pipe(
    map(hosts => hosts.filter(h => h.status === 'CONNECTED' && h.kind === 'PLUGIN_HOST'))
  );
  public readonly hasConnectedHosts$: Observable<boolean> = this.connectedHosts$.pipe(
    map(hosts => hosts.length > 0)
  );

  constructor(
    private readonly _logger: NGXLogger,
    private readonly _pluginManagementService: PluginManagementService,
    private readonly _pluginTranslationService: PluginTranslationService,
    private readonly _stateService: PluginManagementStateService,
    private readonly _translateService: TranslateService,
    private readonly _externalPluginService: ExternalPluginService,
    private readonly _iconService: IconService
  ) {
    this._iconService.registerAll([Information16, Upload16]);
  }

  public ngAfterViewInit(): void {
    this.fields$.next([
      {
        key: 'title',
        label: 'pluginManagement.labels.configurationName',
        viewType: ViewType.TEXT,
      },
      {
        key: 'pluginName',
        label: 'pluginManagement.labels.pluginName',
        viewType: ViewType.TEMPLATE,
        template: this._pluginNameColumnTemplate,
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
      {
        key: 'hostName',
        label: 'pluginManagement.labels.host',
        viewType: ViewType.TEXT,
      },
    ]);
  }

  public ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  // --- Configurations methods ---

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
    this._requestDeleteConfiguration(configuration.source, configuration.id, configuration.title);
  }

  public confirmDeleteConfiguration(): void {
    const target = this.configurationToDelete;
    if (!target) return;
    this.configurationToDelete = null;
    if (target.source === 'external') {
      this._performDeleteExternalConfiguration(target.id, target.title);
    } else {
      this._performDeleteEmbeddedConfiguration(target.id, target.title);
    }
  }

  public cancelDeleteConfiguration(): void {
    this.configurationToDelete = null;
  }

  private _requestDeleteConfiguration(
    source: 'external' | 'embedded',
    id: string,
    title: string
  ): void {
    const usages$ =
      source === 'external'
        ? this._externalPluginService.getConfigurationUsages(id)
        : this._pluginManagementService.getConfigurationUsages(id);

    usages$.pipe(take(1)).subscribe({
      next: usages => {
        if (usages.length > 0) {
          this._showConfigurationInUseModal(title, usages);
          return;
        }
        this.configurationToDelete = {id, title, source};
        this.deleteConfigurationModalOpen$.next(true);
      },
      error: () => {
        this.configurationToDelete = {id, title, source};
        this.deleteConfigurationModalOpen$.next(true);
      },
    });
  }

  private _performDeleteExternalConfiguration(
    configurationId: string,
    configurationTitle: string
  ): void {
    this._externalPluginService
      .deleteConfiguration(configurationId)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this._stateService.refresh();
        },
        error: (response: HttpErrorResponse) => {
          if (response.status === 409 && response.error?.usages) {
            this._showConfigurationInUseModal(
              configurationTitle,
              response.error.usages as Array<ExternalPluginHostUsage>
            );
            return;
          }
          this._logger.error(
            'Something went wrong with deleting the external plugin configuration.'
          );
        },
      });
  }

  private _performDeleteEmbeddedConfiguration(
    configurationId: string,
    configurationTitle: string
  ): void {
    this._pluginManagementService
      .deletePluginConfiguration(configurationId)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this._stateService.refresh();
        },
        error: (response: HttpErrorResponse) => {
          if (response.status === 409 && response.error?.usages) {
            this._showConfigurationInUseModal(
              configurationTitle,
              response.error.usages as Array<ExternalPluginHostUsage>
            );
            return;
          }
          this._logger.error('Something went wrong with deleting the plugin configuration.');
        },
      });
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
    const configurationTitle = this.selectedExternalConfiguration$.value?.title ?? '';
    this.showExternalEditModal$.next(false);
    this.selectedExternalConfiguration$.next(null);
    this._requestDeleteConfiguration('external', configurationId, configurationTitle);
  }

  public onEmbeddedConfigDeleted(payload: {
    configurationId: string;
    configurationTitle: string;
  }): void {
    this.showEditModal$.next(false);
    this._requestDeleteConfiguration(
      'embedded',
      payload.configurationId,
      payload.configurationTitle
    );
  }

  // --- Plugin upload modal ---

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

  // --- Usage modal ---

  public closeUsageModal(): void {
    this.usageModalOpen$.next(false);
    this.usageModalUsages$.next([]);
    this.usageModalEntityName = null;
  }

  private _showConfigurationInUseModal(
    title: string,
    usages: Array<ExternalPluginHostUsage>
  ): void {
    this.usageModalEntityName =
      title ||
      this._translateService.instant('pluginManagement.configurationInUseModal.thisConfiguration');
    this.usageModalTitleKey = 'pluginManagement.configurationInUseModal.title';
    this.usageModalDescriptionKey = 'pluginManagement.configurationInUseModal.description';
    this.usageModalUsages$.next(usages);
    this.usageModalOpen$.next(true);
  }
}
