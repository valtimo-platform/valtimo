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

import {ChangeDetectionStrategy, Component, OnDestroy} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {HttpErrorResponse} from '@angular/common/http';
import {ActionItem, CarbonListModule, CarbonTag, ColumnConfig, ConfirmationModalModule, ViewType} from '@valtimo/components';
import {
  ExternalPluginHost,
  ExternalPluginHostCreateRequest,
  ExternalPluginHostEventQueueUpdateRequest,
  ExternalPluginHostUsage,
  ExternalPluginService,
} from '@valtimo/plugin';
import {ButtonModule, LoadingModule} from 'carbon-components-angular';
import {BehaviorSubject, EMPTY, fromEvent, merge, Observable, of, Subject, timer} from 'rxjs';
import {catchError, distinctUntilChanged, map, startWith, switchMap, take, takeUntil, tap} from 'rxjs/operators';
import {isEqual} from 'lodash';
import {NGXLogger} from 'ngx-logger';
import {PluginHostModalComponent} from '../plugin-host-modal/plugin-host-modal.component';
import {PluginHostEventQueueModalComponent} from '../plugin-host-event-queue-modal/plugin-host-event-queue-modal.component';
import {PluginUsageModalComponent} from '../plugin-usage-modal/plugin-usage-modal.component';

@Component({
  standalone: true,
  templateUrl: './plugin-hosts-page.component.html',
  styleUrls: ['./plugin-hosts-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ButtonModule,
    LoadingModule,
    CarbonListModule,
    ConfirmationModalModule,
    PluginHostModalComponent,
    PluginHostEventQueueModalComponent,
    PluginUsageModalComponent,
  ],
})
export class PluginHostsPageComponent implements OnDestroy {
  private readonly _destroy$ = new Subject<void>();
  private readonly _refreshHosts$ = new Subject<void>();
  private _hostsInitialLoad = true;

  private readonly _tabVisible$: Observable<boolean> = fromEvent(document, 'visibilitychange').pipe(
    startWith(null),
    map(() => document.visibilityState === 'visible')
  );

  public readonly hostsLoading$ = new BehaviorSubject<boolean>(true);
  public readonly hostsRefreshing$ = new BehaviorSubject<boolean>(false);
  public readonly hostModalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly reloadModalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly deleteHostModalOpen$ = new BehaviorSubject<boolean>(false);
  public hostToDelete: ExternalPluginHost | null = null;

  public readonly eventQueueModalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly hostToEditEventQueue$ = new BehaviorSubject<ExternalPluginHost | null>(null);

  public readonly usageModalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly usageModalUsages$ = new BehaviorSubject<Array<ExternalPluginHostUsage>>([]);
  public usageModalEntityName: string | null = null;
  public usageModalTitleKey = '';
  public usageModalDescriptionKey = '';

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
      key: 'statusTag',
      label: 'pluginManagement.labels.status',
      viewType: ViewType.TAGS,
    },
    {
      key: 'lastHealthCheckFormatted',
      label: 'pluginManagement.labels.lastHealthCheck',
      viewType: ViewType.TEXT,
    },
  ];

  public readonly hostActionItems: ActionItem[] = [
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

  public readonly hosts$: Observable<
    Array<ExternalPluginHost & {statusTag: CarbonTag; lastHealthCheckFormatted: string}>
  > = merge(
    this._tabVisible$.pipe(switchMap(visible => (visible ? timer(0, 5000) : EMPTY))),
    this._refreshHosts$
  ).pipe(
    takeUntil(this._destroy$),
    tap(() => {
      if (!this._hostsInitialLoad) {
        this.hostsRefreshing$.next(true);
      }
    }),
    switchMap(() =>
      this._externalPluginService
        .getHosts()
        .pipe(catchError(() => of([] as ExternalPluginHost[])))
    ),
    map(hosts => hosts.filter(h => h.kind === 'PLUGIN_HOST')),
    switchMap(hosts =>
      this._translateService.stream('key').pipe(
        map(() =>
          hosts.map(host => ({
            ...host,
            statusTag: this._getStatusTag(host.status),
            lastHealthCheckFormatted: this._formatLastHealthCheck(host.lastHealthCheck),
          }))
        )
      )
    ),
    tap(() => {
      this._hostsInitialLoad = false;
      this.hostsLoading$.next(false);
      this.hostsRefreshing$.next(false);
    }),
    distinctUntilChanged((prev, curr) => isEqual(prev, curr))
  );

  constructor(
    private readonly _logger: NGXLogger,
    private readonly _translateService: TranslateService,
    private readonly _externalPluginService: ExternalPluginService
  ) {}

  public ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

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
        this.reloadModalOpen$.next(true);
      },
      error: () => {
        this._logger.error('Something went wrong with creating the plugin host.');
      },
    });
  }

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
          this.hostsLoading$.next(true);
          this._refreshHosts$.next();
        },
        error: (response: HttpErrorResponse) => {
          if (response.status === 409 && response.error?.usages) {
            this.hostToDelete = null;
            this._showHostInUseModal(host, response.error.usages as Array<ExternalPluginHostUsage>);
            return;
          }
          this._logger.error('Something went wrong with deleting the plugin host.');
        },
      });
  }

  public cancelDeleteHost(): void {
    this.hostToDelete = null;
  }

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
        this._refreshHosts$.next();
      },
      error: () => {
        this._logger.error('Something went wrong with updating the plugin host event queue.');
      },
    });
  }

  public closeUsageModal(): void {
    this.usageModalOpen$.next(false);
    this.usageModalUsages$.next([]);
    this.usageModalEntityName = null;
  }

  public confirmReload(): void {
    window.location.reload();
  }

  public cancelReload(): void {
    this.hostsLoading$.next(true);
    this._refreshHosts$.next();
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
