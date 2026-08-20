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

import {ChangeDetectionStrategy, Component, OnDestroy, OnInit, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ActivatedRoute, Router} from '@angular/router';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {HttpErrorResponse} from '@angular/common/http';
import {
  ActionItem,
  CarbonListModule,
  CarbonTag,
  ColumnConfig,
  ConfirmationModalModule,
  ViewType,
} from '@valtimo/components';
import {
  ExternalPluginConfiguration,
  ExternalPluginDefinition,
  ExternalPluginHost,
  ExternalPluginHostEventQueueUpdateRequest,
  ExternalPluginHostUsage,
  ExternalPluginService,
} from '@valtimo/plugin';
import {ButtonModule, LoadingModule} from 'carbon-components-angular';
import {
  BehaviorSubject,
  EMPTY,
  forkJoin,
  fromEvent,
  merge,
  Observable,
  of,
  Subject,
  timer,
} from 'rxjs';
import {
  catchError,
  distinctUntilChanged,
  map,
  startWith,
  switchMap,
  take,
  takeUntil,
  tap,
} from 'rxjs/operators';
import {isEqual} from 'lodash';
import {NGXLogger} from 'ngx-logger';
import {PluginAppAddModalComponent} from '../plugin-app-add-modal/plugin-app-add-modal.component';
import {PluginExternalEditModalComponent} from '../plugin-external-edit-modal/plugin-external-edit-modal.component';
import {PluginHostEventQueueModalComponent} from '../plugin-host-event-queue-modal/plugin-host-event-queue-modal.component';
import {PluginLogModalComponent} from '../plugin-log-modal/plugin-log-modal.component';
import {PluginUsageModalComponent} from '../plugin-usage-modal/plugin-usage-modal.component';
import {UnifiedPluginConfigurationRow} from '../../models';
import {cspAllowsFrameOrigin} from '../../utils';

/** One row on the apps page: the APP-kind host enriched with its discovered plugin and configuration. */
interface PluginAppRow extends ExternalPluginHost {
  statusTag: CarbonTag;
  lastHealthCheckFormatted: string;
  configurationTitle: string;
  definition: ExternalPluginDefinition | null;
  configuration: ExternalPluginConfiguration | null;
  /** Whether the app's plugin declares the `log` capability — apps without it serve no logs endpoint. */
  supportsLogs: boolean;
}

/** Query parameter that restores the add-app stepper at the configuration step after a reload. */
const CONFIGURE_APP_QUERY_PARAM = 'configureApp';

/**
 * Manifest capability an app must declare for its host to expose a logs endpoint. An app that does
 * not declare it (e.g. a lightweight app that only serves a plugin definition) has no logs to fetch,
 * so the logs action is disabled rather than left to fail against a missing endpoint. Plugins
 * uploaded to a full plugin host are not gated this way — the host always serves the logs endpoint.
 */
const LOG_CAPABILITY = 'log';

@Component({
  standalone: true,
  templateUrl: './plugin-apps-page.component.html',
  styleUrls: ['./plugin-apps-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ButtonModule,
    LoadingModule,
    CarbonListModule,
    ConfirmationModalModule,
    PluginAppAddModalComponent,
    PluginExternalEditModalComponent,
    PluginHostEventQueueModalComponent,
    PluginLogModalComponent,
    PluginUsageModalComponent,
  ],
})
export class PluginAppsPageComponent implements OnInit, OnDestroy {
  private readonly _destroy$ = new Subject<void>();
  private readonly _refreshApps$ = new Subject<void>();
  private _appsInitialLoad = true;

  private readonly _tabVisible$: Observable<boolean> = fromEvent(document, 'visibilitychange').pipe(
    startWith(null),
    map(() => document.visibilityState === 'visible')
  );

  public readonly appsLoading$ = new BehaviorSubject<boolean>(true);
  public readonly appsRefreshing$ = new BehaviorSubject<boolean>(false);

  // --- Add / configure stepper ---
  public readonly $addModalOpen = signal<boolean>(false);
  public readonly $resumeHostId = signal<string | null>(null);

  // --- Refresh-before-configure dialog (list action on an app added in this page session) ---
  public readonly refreshModalOpen$ = new BehaviorSubject<boolean>(false);
  private _pendingRefreshHostId: string | null = null;

  // --- Edit configuration modal ---
  public readonly $editModalOpen = signal<boolean>(false);
  public readonly $selectedConfiguration = signal<UnifiedPluginConfigurationRow | null>(null);

  // --- Configuration delete ---
  public readonly deleteConfigurationModalOpen$ = new BehaviorSubject<boolean>(false);
  public configurationToDelete: {id: string; title: string} | null = null;

  // --- Logs modal ---
  public readonly $logModalOpen = signal<boolean>(false);
  public readonly $logConfigurationId = signal<string | null>(null);
  public readonly $logConfigurationTitle = signal<string>('');

  // --- Host delete ---
  public readonly deleteHostModalOpen$ = new BehaviorSubject<boolean>(false);
  public hostToDelete: ExternalPluginHost | null = null;

  public readonly eventQueueModalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly hostToEditEventQueue$ = new BehaviorSubject<ExternalPluginHost | null>(null);

  public readonly usageModalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly usageModalUsages$ = new BehaviorSubject<Array<ExternalPluginHostUsage>>([]);
  public usageModalEntityName: string | null = null;
  public usageModalTitleKey = '';
  public usageModalDescriptionKey = '';

  public readonly appFields: ColumnConfig[] = [
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
      key: 'statusTag',
      label: 'pluginManagement.labels.status',
      viewType: ViewType.TAGS,
    },
    {
      key: 'lastHealthCheckFormatted',
      label: 'pluginManagement.labels.lastHealthCheck',
      viewType: ViewType.TEXT,
    },
    {
      key: 'configurationTitle',
      label: 'pluginManagement.labels.configuration',
      viewType: ViewType.TEXT,
    },
  ];

  public readonly appActionItems: ActionItem[] = [
    // Configuring an app for the first time happens through the add-app stepper (or a row click on
    // an unconfigured app); a dedicated menu entry that only ever showed disabled once configured is
    // omitted until editing apps/hosts is reworked in a later story.
    {
      callback: this.editConfiguration.bind(this),
      label: 'pluginManagement.editConfiguration',
      disabledCallback: (row: PluginAppRow) => !row.configuration,
    },
    {
      callback: this.viewLogs.bind(this),
      label: 'pluginManagement.logs.menuItem',
      // Also disabled when the app declares no `log` capability: its host serves no logs endpoint,
      // so fetching would fail rather than return an empty page.
      disabledCallback: (row: PluginAppRow) => !row.configuration || !row.supportsLogs,
    },
    {
      callback: this.editHostEventQueue.bind(this),
      label: 'pluginManagement.editEventQueue',
    },
    {
      callback: this.deleteHost.bind(this),
      label: 'interface.delete',
      type: 'danger',
    },
  ];

  public readonly apps$: Observable<Array<PluginAppRow>> = merge(
    this._tabVisible$.pipe(switchMap(visible => (visible ? timer(0, 5000) : EMPTY))),
    this._refreshApps$
  ).pipe(
    takeUntil(this._destroy$),
    tap(() => {
      if (!this._appsInitialLoad) {
        this.appsRefreshing$.next(true);
      }
    }),
    switchMap(() =>
      forkJoin({
        hosts: this._externalPluginService
          .getHosts()
          .pipe(catchError(() => of([] as ExternalPluginHost[]))),
        definitions: this._externalPluginService
          .getDefinitions()
          .pipe(catchError(() => of([] as ExternalPluginDefinition[]))),
        configurations: this._externalPluginService
          .getConfigurations()
          .pipe(catchError(() => of([] as ExternalPluginConfiguration[]))),
      })
    ),
    switchMap(({hosts, definitions, configurations}) =>
      this._translateService
        .stream('key')
        .pipe(
          map(() =>
            hosts
              .filter(host => host.kind === 'APP')
              .map(host => this._toAppRow(host, definitions, configurations))
          )
        )
    ),
    tap(() => {
      this._appsInitialLoad = false;
      this.appsLoading$.next(false);
      this.appsRefreshing$.next(false);
    }),
    distinctUntilChanged((prev, curr) => isEqual(prev, curr))
  );

  constructor(
    private readonly _logger: NGXLogger,
    private readonly _route: ActivatedRoute,
    private readonly _router: Router,
    private readonly _translateService: TranslateService,
    private readonly _externalPluginService: ExternalPluginService
  ) {}

  public ngOnInit(): void {
    // Restore the add-app stepper at the configuration step after the CSP refresh (or after a
    // manual reload while configuring).
    const resumeHostId = this._route.snapshot.queryParamMap.get(CONFIGURE_APP_QUERY_PARAM);
    if (resumeHostId) {
      this.$resumeHostId.set(resumeHostId);
      this.$addModalOpen.set(true);
    }
  }

  public ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  // --- Add / configure stepper ---

  public openAddModal(): void {
    this.$resumeHostId.set(null);
    this.$addModalOpen.set(true);
  }

  public onAddModalClose(): void {
    this._closeAddModal();
  }

  public onAddModalCompleted(): void {
    this._closeAddModal();
  }

  public onRowClicked(row: PluginAppRow): void {
    if (row.configuration) {
      this.editConfiguration(row);
    } else {
      this.configureApp(row);
    }
  }

  public configureApp(row: PluginAppRow): void {
    if (row.configuration) return;

    // An app registered during this page session is not yet covered by the bootstrap CSP —
    // configuring it requires the same refresh-and-resume the stepper uses.
    if (cspAllowsFrameOrigin(row.baseUrl)) {
      this._openResume(row.id);
    } else {
      this._pendingRefreshHostId = row.id;
      this.refreshModalOpen$.next(true);
    }
  }

  public onRefreshConfirm(): void {
    if (!this._pendingRefreshHostId) return;
    const url = new URL(window.location.href);
    url.searchParams.set(CONFIGURE_APP_QUERY_PARAM, this._pendingRefreshHostId);
    window.location.assign(url.toString());
  }

  public onRefreshCancel(): void {
    this._pendingRefreshHostId = null;
  }

  private _openResume(hostId: string): void {
    this.$resumeHostId.set(hostId);
    this.$addModalOpen.set(true);
    this._setConfigureAppQueryParam(hostId);
  }

  private _closeAddModal(): void {
    this.$addModalOpen.set(false);
    this.$resumeHostId.set(null);
    this._setConfigureAppQueryParam(null);
    this.appsLoading$.next(true);
    this._refreshApps$.next();
  }

  /** Keeps the resume parameter in the URL while configuring, so a manual reload restores the step. */
  private _setConfigureAppQueryParam(hostId: string | null): void {
    this._router.navigate([], {
      relativeTo: this._route,
      queryParams: {[CONFIGURE_APP_QUERY_PARAM]: hostId},
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  // --- Edit configuration ---

  public editConfiguration(row: PluginAppRow): void {
    const configuration = row.configuration;
    if (!configuration) return;

    this.$selectedConfiguration.set({
      id: configuration.id,
      title: configuration.title,
      pluginName: '',
      definitionKey: row.definition?.pluginId ?? '',
      source: 'external',
      externalDefinitionId: configuration.definitionId,
    });
    this.$editModalOpen.set(true);
  }

  public closeEditModal(): void {
    this.$editModalOpen.set(false);
    this.$selectedConfiguration.set(null);
  }

  public onConfigurationSaved(): void {
    this.closeEditModal();
    this._refreshApps$.next();
  }

  // --- Configuration delete ---

  public onConfigurationDeleteRequested(configurationId: string): void {
    const configurationTitle = this.$selectedConfiguration()?.title ?? '';
    this.closeEditModal();

    this._externalPluginService
      .getConfigurationUsages(configurationId)
      .pipe(take(1))
      .subscribe({
        next: usages => {
          if (usages.length > 0) {
            this._showConfigurationInUseModal(configurationTitle, usages);
            return;
          }
          this.configurationToDelete = {id: configurationId, title: configurationTitle};
          this.deleteConfigurationModalOpen$.next(true);
        },
        error: () => {
          this.configurationToDelete = {id: configurationId, title: configurationTitle};
          this.deleteConfigurationModalOpen$.next(true);
        },
      });
  }

  public confirmDeleteConfiguration(): void {
    const target = this.configurationToDelete;
    if (!target) return;
    this.configurationToDelete = null;

    this._externalPluginService
      .deleteConfiguration(target.id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this._refreshApps$.next();
        },
        error: (response: HttpErrorResponse) => {
          if (response.status === 409 && response.error?.usages) {
            this._showConfigurationInUseModal(
              target.title,
              response.error.usages as Array<ExternalPluginHostUsage>
            );
            return;
          }
          this._logger.error('Something went wrong with deleting the app configuration.');
        },
      });
  }

  public cancelDeleteConfiguration(): void {
    this.configurationToDelete = null;
  }

  // --- Logs ---

  public viewLogs(row: PluginAppRow): void {
    if (!row.configuration || !row.supportsLogs) return;
    this.$logConfigurationId.set(row.configuration.id);
    this.$logConfigurationTitle.set(row.configuration.title);
    this.$logModalOpen.set(true);
  }

  public closeLogModal(): void {
    this.$logModalOpen.set(false);
    this.$logConfigurationId.set(null);
    this.$logConfigurationTitle.set('');
  }

  // --- Host delete ---

  public deleteHost(host: ExternalPluginHost): void {
    this._externalPluginService
      .getHostUsages(host.id)
      .pipe(take(1))
      .subscribe({
        next: usages => {
          if (usages.length > 0) {
            this._showHostInUseModal(host, usages);
            return;
          }
          this.hostToDelete = host;
          this.deleteHostModalOpen$.next(true);
        },
        error: () => {
          this.hostToDelete = host;
          this.deleteHostModalOpen$.next(true);
        },
      });
  }

  public confirmDeleteHost(): void {
    if (!this.hostToDelete) return;
    const host = this.hostToDelete;
    this._externalPluginService
      .deleteHost(host.id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.hostToDelete = null;
          this.appsLoading$.next(true);
          this._refreshApps$.next();
        },
        error: (response: HttpErrorResponse) => {
          if (response.status === 409 && response.error?.usages) {
            this.hostToDelete = null;
            this._showHostInUseModal(host, response.error.usages as Array<ExternalPluginHostUsage>);
            return;
          }
          this._logger.error('Something went wrong with deleting the app.');
        },
      });
  }

  public cancelDeleteHost(): void {
    this.hostToDelete = null;
  }

  // --- Event queue ---

  public editHostEventQueue(host: ExternalPluginHost): void {
    this.hostToEditEventQueue$.next(host);
    this.eventQueueModalOpen$.next(true);
  }

  public closeEventQueueModal(): void {
    this.eventQueueModalOpen$.next(false);
    this.hostToEditEventQueue$.next(null);
  }

  public submitEventQueueUpdate(request: ExternalPluginHostEventQueueUpdateRequest): void {
    const host = this.hostToEditEventQueue$.value;
    if (!host) return;
    this._externalPluginService.updateHostEventQueue(host.id, request).subscribe({
      next: () => {
        this.eventQueueModalOpen$.next(false);
        this.hostToEditEventQueue$.next(null);
        this._refreshApps$.next();
      },
      error: () => {
        this._logger.error('Something went wrong with updating the app event queue.');
      },
    });
  }

  // --- Usage modal ---

  public closeUsageModal(): void {
    this.usageModalOpen$.next(false);
    this.usageModalUsages$.next([]);
    this.usageModalEntityName = null;
  }

  // --- Private helpers ---

  private _toAppRow(
    host: ExternalPluginHost,
    definitions: Array<ExternalPluginDefinition>,
    configurations: Array<ExternalPluginConfiguration>
  ): PluginAppRow {
    const hostDefinitions = definitions.filter(definition => definition.hostId === host.id);
    const definition =
      hostDefinitions.find(candidate => candidate.status === 'AVAILABLE') ??
      hostDefinitions[0] ??
      null;

    const hostDefinitionIds = new Set(hostDefinitions.map(hostDefinition => hostDefinition.id));
    // An app conceptually has a single configuration; should more exist (e.g. after a version
    // upgrade), the most recent one is the one the page manages.
    const configuration =
      configurations
        .filter(candidate => hostDefinitionIds.has(candidate.definitionId))
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))[0] ?? null;

    return {
      ...host,
      statusTag: this._getStatusTag(host.status),
      lastHealthCheckFormatted: this._formatLastHealthCheck(host.lastHealthCheck),
      configurationTitle:
        configuration?.title ?? this._translateService.instant('pluginManagement.notConfigured'),
      definition,
      configuration,
      supportsLogs: (definition?.manifest?.permissions?.capabilities ?? []).includes(LOG_CAPABILITY),
    };
  }

  private _showHostInUseModal(
    host: ExternalPluginHost,
    usages: Array<ExternalPluginHostUsage>
  ): void {
    this.usageModalEntityName =
      host.name || this._translateService.instant('pluginManagement.hostInUseModal.thisHost');
    this.usageModalTitleKey = 'pluginManagement.hostInUseModal.title';
    this.usageModalDescriptionKey = 'pluginManagement.hostInUseModal.description';
    this.usageModalUsages$.next(usages);
    this.usageModalOpen$.next(true);
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

  private _getStatusTag(status: 'CONNECTED' | 'UNREACHABLE'): CarbonTag {
    return {
      content: this._translateService.instant(`pluginManagement.hostStatus.${status}`),
      type: status === 'CONNECTED' ? 'green' : 'red',
    };
  }

  private _formatLastHealthCheck(lastHealthCheck: string | null): string {
    if (!lastHealthCheck) {
      return '-';
    }
    const date = new Date(lastHealthCheck);
    return date.toLocaleString(this._translateService.currentLang || 'en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
