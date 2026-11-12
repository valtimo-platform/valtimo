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

import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {CommonModule, DatePipe} from '@angular/common';
import {HttpErrorResponse} from '@angular/common/http';
import {ActivatedRoute, Params, Router, RouterModule} from '@angular/router';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  distinctUntilChanged,
  EMPTY,
  finalize,
  interval,
  map,
  merge,
  Observable,
  of,
  shareReplay,
  startWith,
  Subject,
  switchMap,
  take,
  takeUntil,
  tap,
  withLatestFrom,
} from 'rxjs';
import {
  ButtonModule,
  IconModule,
  IconService,
  ListItem,
  LoadingModule,
  NotificationModule,
  ProgressBarModule,
  TabsModule,
  TagModule,
} from 'carbon-components-angular';
import {Launch16, Renew16, WarningAlt16} from '@carbon/icons';
import {
  ActionItem,
  CarbonListModule,
  ColumnConfig,
  ConfirmationModalModule,
  Pagination,
  TooltipIconModule,
  ViewType,
} from '@valtimo/components';
import {GlobalNotificationService, Page} from '@valtimo/shared';
import {AdminSettingsManagementApiService} from '../../services';
import {OPENSEARCH_TAB_PARAM, OPENSEARCH_TEST_IDS} from '../../constants';
import {
  IndexRejectionDto,
  ReindexStatusDto,
  RetryRejectionsResultDto,
  StartReindexRequestDto,
  TopologyStatusDto,
} from '../../models';
import {DocumentService} from '@valtimo/document';
import {StartReindexModalComponent} from '../start-reindex-modal/start-reindex-modal.component';

enum OpensearchTab {
  REINDEX_RUNS = 'reindexRuns',
  REJECTED_CASES = 'rejectedCases',
}

@Component({
  standalone: true,
  selector: 'valtimo-admin-settings-opensearch',
  templateUrl: './admin-settings-opensearch.component.html',
  styleUrls: ['./admin-settings-opensearch.component.scss'],
  imports: [
    CommonModule,
    DatePipe,
    TranslateModule,
    ButtonModule,
    IconModule,
    LoadingModule,
    NotificationModule,
    ProgressBarModule,
    TabsModule,
    TagModule,
    CarbonListModule,
    ConfirmationModalModule,
    RouterModule,
    StartReindexModalComponent,
    TooltipIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSettingsOpensearchComponent implements OnInit, OnDestroy {
  @ViewChild('rejectionCaseColumn', {static: true})
  public rejectionCaseColumnTemplate!: TemplateRef<unknown>;

  private readonly _destroy$ = new Subject<void>();
  private readonly _manualRefresh$ = new BehaviorSubject<void>(undefined);
  private readonly _silentRefresh$ = new Subject<void>();

  protected readonly testIds = OPENSEARCH_TEST_IDS;
  protected readonly OpensearchTab = OpensearchTab;
  protected readonly $activeTab = toSignal(
    this._route.queryParams.pipe(map(params => this._getTab(params))),
    {initialValue: this._getTab(this._route.snapshot.queryParams)}
  );

  public readonly fields: ColumnConfig[] = [
    {key: 'statusTag', label: 'adminSettings.opensearch.reindex.columns.status', viewType: ViewType.TAGS},
    {key: 'documentDefinition', label: 'adminSettings.opensearch.reindex.columns.documentDefinition', viewType: ViewType.TEXT},
    {key: 'startedOn', label: 'adminSettings.opensearch.reindex.columns.startedOn', viewType: ViewType.DATE_TIME},
    {key: 'finishedOn', label: 'adminSettings.opensearch.reindex.columns.finishedOn', viewType: ViewType.DATE_TIME},
    {key: 'progress', label: 'adminSettings.opensearch.reindex.columns.progress', viewType: ViewType.TEXT},
  ];

  public pagination: Pagination = {
    collectionSize: 0,
    page: 1,
    size: 10,
  };

  public readonly showModal$ = new BehaviorSubject<boolean>(false);
  public readonly startingReindex$ = new BehaviorSubject<boolean>(false);
  public readonly loading$ = new BehaviorSubject<boolean>(false);

  public documentDefinitions$: Observable<ListItem[]>;

  public readonly runs$: Observable<Page<ReindexStatusDto>> = merge(
    this._manualRefresh$.pipe(
      switchMap(() => {
        this.loading$.next(true);
        return this._apiService.getReindexRuns(this.pagination.page - 1, this.pagination.size).pipe(
          finalize(() => this.loading$.next(false))
        );
      })
    ),
    this._silentRefresh$.pipe(
      switchMap(() => this._apiService.getReindexRuns(this.pagination.page - 1, this.pagination.size))
    )
  ).pipe(shareReplay(1));

  public readonly tableItems$: Observable<any[]> = this.runs$.pipe(
    switchMap(page => {
      this.pagination = {...this.pagination, collectionSize: page.totalElements};
      if (page.content.length === 0) {
        return of([]);
      }
      const allDefinitionsKey = 'adminSettings.opensearch.reindex.allDocumentDefinitions';
      const statusKeys = page.content.map(run => `adminSettings.opensearch.reindex.statuses.${run.status}`);
      return this._translateService.get([...statusKeys, allDefinitionsKey]).pipe(
        map(translations => page.content.map(run => ({
          ...run,
          progress: `${run.processedCount} / ${run.totalCount}`,
          documentDefinition: run.scope?.documentDefinitionName || translations[allDefinitionsKey],
          statusTag: {
            content: translations[`adminSettings.opensearch.reindex.statuses.${run.status}`],
            type: this._getStatusTagType(run.status),
          },
        })))
      );
    })
  );

  public readonly hasRunningRun$: Observable<boolean> = this.runs$.pipe(
    map(page => page.content.some(run => run.status === 'RUNNING'))
  );

  // Chained after runs, not fetched in parallel: the poll that sees a run finish must see its topology.
  public readonly topology$: Observable<TopologyStatusDto | null> = this.runs$.pipe(
    switchMap(() => this._apiService.getTopologyStatus()),
    startWith(null),
    shareReplay(1)
  );

  public readonly legacyOrStale$: Observable<boolean> = this.topology$.pipe(
    map(status => !!status?.available && !!status?.legacyOrStale)
  );

  public readonly catchingUp$: Observable<boolean> = this.topology$.pipe(
    map(status => !!status?.catchingUp)
  );

  public readonly rejectedDefinitions$: Observable<string> = this.topology$.pipe(
    map(status => (status?.rejectedDefinitions ?? []).join(', '))
  );

  public rejectionFields: ColumnConfig[] = [];

  public readonly rejectionActionItems: ActionItem[] = [
    {
      label: 'adminSettings.opensearch.rejections.retryNow',
      callback: (rejection: IndexRejectionDto) => this.onRetryNow(rejection),
      disabled$: () => this.retryingRejections$,
    },
  ];

  public rejectionsPagination: Pagination = {
    collectionSize: 0,
    page: 1,
    size: 10,
  };

  public readonly rejectionsLoading$ = new BehaviorSubject<boolean>(true);
  public readonly retryingRejections$ = new BehaviorSubject<boolean>(false);
  public readonly showRetryAllModal$ = new BehaviorSubject<boolean>(false);

  private readonly _rejectionsPageRefresh$ = new Subject<void>();

  public readonly rejections$: Observable<Page<IndexRejectionDto> | null> = merge(
    this.topology$.pipe(map(topology => ({topology, showLoading: false}))),
    this._rejectionsPageRefresh$.pipe(
      withLatestFrom(this.topology$),
      map(([, topology]) => ({topology, showLoading: true}))
    )
  ).pipe(
    switchMap(({topology, showLoading}) => {
      if (!topology?.rejectedDefinitions?.length) {
        this.rejectionsLoading$.next(false);
        return of(null);
      }
      if (showLoading) this.rejectionsLoading$.next(true);

      return this._apiService
        .getIndexRejections(this.rejectionsPagination.page - 1, this.rejectionsPagination.size)
        .pipe(
          catchError(() => EMPTY),
          finalize(() => this.rejectionsLoading$.next(false))
        );
    }),
    tap(page => {
      this.rejectionsPagination = page
        ? {...this.rejectionsPagination, collectionSize: page.totalElements}
        : {...this.rejectionsPagination, collectionSize: 0, page: 1};
    }),
    shareReplay(1)
  );

  constructor(
    private readonly _apiService: AdminSettingsManagementApiService,
    private readonly _documentService: DocumentService,
    private readonly _translateService: TranslateService,
    private readonly _route: ActivatedRoute,
    private readonly _router: Router,
    private readonly _iconService: IconService,
    private readonly _notificationService: GlobalNotificationService
  ) {
    this._iconService.registerAll([Launch16, Renew16, WarningAlt16]);
  }

  public ngOnInit(): void {
    this.rejectionFields = [
      {
        key: 'definitionName',
        label: 'adminSettings.opensearch.rejections.columns.definitionName',
        viewType: ViewType.TEXT,
      },
      {
        key: 'documentId',
        label: 'adminSettings.opensearch.rejections.columns.documentId',
        viewType: ViewType.TEMPLATE,
        template: this.rejectionCaseColumnTemplate,
      },
      {
        key: 'attempts',
        label: 'adminSettings.opensearch.rejections.columns.attempts',
        viewType: ViewType.TEXT,
      },
      {
        key: 'firstRejectedOn',
        label: 'adminSettings.opensearch.rejections.columns.firstRejectedOn',
        viewType: ViewType.DATE_TIME,
      },
      {
        key: 'lastRejectedOn',
        label: 'adminSettings.opensearch.rejections.columns.lastRejectedOn',
        viewType: ViewType.DATE_TIME,
      },
      {
        key: 'nextRetryOn',
        label: 'adminSettings.opensearch.rejections.columns.nextRetryOn',
        viewType: ViewType.DATE_TIME,
      },
    ];

    this.documentDefinitions$ = this._documentService.queryDefinitionsForManagement().pipe(
      switchMap(page =>
        this._translateService.get('adminSettings.opensearch.reindex.allDocumentDefinitions').pipe(
          map(allLabel => [
            {content: allLabel, value: null, selected: false},
            ...page.content.map(def => ({
              content: def.id.name,
              value: def.id.name,
              selected: false,
            })),
          ])
        )
      ),
      startWith([])
    );

    combineLatest([this.hasRunningRun$, this.catchingUp$])
      .pipe(
        map(([hasRunning, catchingUp]) => hasRunning || catchingUp),
        distinctUntilChanged(),
        switchMap(shouldPoll => (shouldPoll ? interval(3000) : EMPTY)),
        takeUntil(this._destroy$)
      )
      .subscribe(() => this._silentRefresh$.next());
  }

  // Carbon also emits for the already active tab on load, so only navigate on a real change.
  public onTabSelected(tab: OpensearchTab): void {
    if (tab === this.$activeTab()) return;

    this._router.navigate([], {
      relativeTo: this._route,
      queryParams: {
        [OPENSEARCH_TAB_PARAM]: tab === OpensearchTab.REJECTED_CASES ? tab : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  public onPageChange(page: number): void {
    this.pagination = {...this.pagination, page};
    this._manualRefresh$.next();
  }

  public onPageSizeChange(size: number): void {
    this.pagination = {...this.pagination, size, page: 1};
    this._manualRefresh$.next();
  }

  public openModal(): void {
    this.showModal$.next(true);
  }

  public onModalClose(request: StartReindexRequestDto | null): void {
    this.showModal$.next(false);
    if (!request) return;

    this.startingReindex$.next(true);
    this._apiService
      .startReindex(request)
      .pipe(
        take(1),
        finalize(() => this.startingReindex$.next(false))
      )
      .subscribe({
        next: () => this._manualRefresh$.next(),
        error: (error: HttpErrorResponse) => this._onStartReindexError(error),
      });
  }

  public caseDetailLink(rejection: IndexRejectionDto): string[] {
    return ['/cases', rejection.definitionName, 'document', rejection.documentId];
  }

  public onRejectionsPageChange(page: number): void {
    this.rejectionsPagination = {...this.rejectionsPagination, page};
    this._rejectionsPageRefresh$.next();
  }

  public onRejectionsPageSizeChange(size: number | string): void {
    this.rejectionsPagination = {...this.rejectionsPagination, size: +size, page: 1};
    this._rejectionsPageRefresh$.next();
  }

  public onRetryNow(rejection: IndexRejectionDto): void {
    this.retryingRejections$.next(true);
    this._apiService
      .retryIndexRejections([rejection.documentId])
      .pipe(finalize(() => this.retryingRejections$.next(false)))
      .subscribe({
        next: result => {
          this._showRetryResult(rejection.documentId, result);
          this._silentRefresh$.next();
        },
        error: (error: HttpErrorResponse) => this._onRetryError(error),
      });
  }

  public openRetryAllModal(): void {
    this.showRetryAllModal$.next(true);
  }

  public onRetryAllCancel(): void {
    this.showRetryAllModal$.next(false);
  }

  public onRetryAllConfirm(): void {
    this.showRetryAllModal$.next(false);
    this.retryingRejections$.next(true);
    this._apiService
      .retryAllIndexRejections()
      .pipe(finalize(() => this.retryingRejections$.next(false)))
      .subscribe({
        next: result => {
          this._notificationService.showToast({
            type: 'success',
            title: this._translateService.instant('adminSettings.opensearch.rejections.scheduled', {
              count: result.scheduled,
            }),
          });
          this._silentRefresh$.next();
        },
        error: (error: HttpErrorResponse) => this._onRetryError(error),
      });
  }

  private _showRetryResult(documentId: string, result: RetryRejectionsResultDto): void {
    if (result.indexed?.includes(documentId)) {
      this._showToast('success', 'adminSettings.opensearch.rejections.indexed');
    } else if (result.deleted?.includes(documentId)) {
      this._showToast('info', 'adminSettings.opensearch.rejections.deleted');
    } else {
      this._showToast('warning', 'adminSettings.opensearch.rejections.stillRejected');
    }
  }

  private _onRetryError(error: HttpErrorResponse): void {
    // Other statuses are toasted by HttpErrorInterceptor.
    if (error.status !== 400 && error.status !== 409) return;

    this._notificationService.showToast({
      type: 'error',
      title: this._translateService.instant('adminSettings.opensearch.rejections.retryFailed'),
      caption: error.error?.error ?? '',
    });

    if (error.status === 409) this._silentRefresh$.next();
  }

  private _showToast(type: 'success' | 'info' | 'warning', translationKey: string): void {
    this._notificationService.showToast({
      type,
      title: this._translateService.instant(translationKey),
    });
  }

  private _onStartReindexError(error: HttpErrorResponse): void {
    // Other statuses are toasted by HttpErrorInterceptor.
    if (error.status !== 400 && error.status !== 409) return;

    this._notificationService.showToast({
      type: 'error',
      title: this._translateService.instant('adminSettings.opensearch.reindex.startFailed'),
      caption: error.error?.error ?? '',
    });

    if (error.status === 409) this._manualRefresh$.next();
  }

  private _getTab(params: Params): OpensearchTab {
    return params[OPENSEARCH_TAB_PARAM] === OpensearchTab.REJECTED_CASES
      ? OpensearchTab.REJECTED_CASES
      : OpensearchTab.REINDEX_RUNS;
  }

  private _getStatusTagType(status: string): string {
    switch (status) {
      case 'RUNNING':
        return 'blue';
      case 'COMPLETED':
        return 'green';
      case 'COMPLETED_WITH_ERRORS':
        return 'orange';
      case 'FAILED':
        return 'red';
      case 'STOPPED':
        return 'gray';
      default:
        return 'gray';
    }
  }

  public navigateToLogs(run: ReindexStatusDto): void {
    const afterTimestamp = new Date(new Date(run.startedOn).getTime() - 5000).toISOString();
    const beforeTimestamp = run.finishedOn
      ? new Date(new Date(run.finishedOn).getTime() + 5000).toISOString()
      : new Date().toISOString();

    // Skipped-document messages are logged at WARN; a FAILED run logs the failure at ERROR.
    const level = run.status === 'COMPLETED_WITH_ERRORS' ? 'WARN' : 'ERROR';

    this._router.navigate(['/logging'], {
      queryParams: {
        level,
        afterTimestamp,
        beforeTimestamp,
      },
    });
  }

  public ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }
}
