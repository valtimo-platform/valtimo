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

import {ChangeDetectionStrategy, Component, OnDestroy, OnInit} from '@angular/core';
import {CommonModule, DatePipe} from '@angular/common';
import {Router} from '@angular/router';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  BehaviorSubject,
  finalize,
  interval,
  map,
  merge,
  Observable,
  startWith,
  Subject,
  switchMap,
  take,
  takeUntil,
  takeWhile,
} from 'rxjs';
import {
  ButtonModule,
  IconModule,
  IconService,
  ListItem,
  LoadingModule,
  ProgressBarModule,
  TagModule,
} from 'carbon-components-angular';
import {Launch16} from '@carbon/icons';
import {CarbonListModule, ColumnConfig, Pagination, TooltipIconModule, ViewType} from '@valtimo/components';
import {Page} from '@valtimo/shared';
import {AdminSettingsManagementApiService} from '../../services';
import {ReindexStatusDto, StartReindexRequestDto} from '../../models';
import {DocumentService} from '@valtimo/document';
import {StartReindexModalComponent} from '../start-reindex-modal/start-reindex-modal.component';

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
    ProgressBarModule,
    TagModule,
    CarbonListModule,
    StartReindexModalComponent,
    TooltipIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSettingsOpensearchComponent implements OnInit, OnDestroy {
  private readonly _destroy$ = new Subject<void>();
  private readonly _manualRefresh$ = new BehaviorSubject<void>(undefined);
  private readonly _silentRefresh$ = new Subject<void>();

  public readonly fields: ColumnConfig[] = [
    {key: 'statusTag', label: 'adminSettings.opensearch.reindex.columns.status', viewType: ViewType.TAGS},
    {key: 'startedOn', label: 'adminSettings.opensearch.reindex.columns.startedOn', viewType: ViewType.DATE},
    {key: 'finishedOn', label: 'adminSettings.opensearch.reindex.columns.finishedOn', viewType: ViewType.DATE},
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
  );

  public readonly tableItems$: Observable<any[]> = this.runs$.pipe(
    switchMap(page => {
      this.pagination = {...this.pagination, collectionSize: page.totalElements};
      const statusKeys = page.content.map(run => `adminSettings.opensearch.reindex.statuses.${run.status}`);
      return this._translateService.get(statusKeys).pipe(
        map(translations => page.content.map(run => ({
          ...run,
          progress: `${run.processedCount} / ${run.totalCount}`,
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

  constructor(
    private readonly _apiService: AdminSettingsManagementApiService,
    private readonly _documentService: DocumentService,
    private readonly _translateService: TranslateService,
    private readonly _router: Router,
    private readonly _iconService: IconService
  ) {
    this._iconService.register(Launch16);
  }

  public ngOnInit(): void {
    this.documentDefinitions$ = this._documentService.queryDefinitionsForManagement().pipe(
      map(page =>
        page.content.map(def => ({
          content: def.id.name,
          selected: false,
        }))
      ),
      startWith([])
    );

    this.hasRunningRun$
      .pipe(
        switchMap(hasRunning => {
          if (!hasRunning) return [];
          return interval(3000).pipe(
            takeWhile(() => true),
            takeUntil(this._destroy$)
          );
        }),
        takeUntil(this._destroy$)
      )
      .subscribe(() => this._silentRefresh$.next());
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
        error: err => {
          if (err.status === 409) {
            this._manualRefresh$.next();
          }
        },
      });
  }

  private _getStatusTagType(status: string): string {
    switch (status) {
      case 'RUNNING':
        return 'blue';
      case 'COMPLETED':
        return 'green';
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

    this._router.navigate(['/logging'], {
      queryParams: {
        level: 'ERROR',
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
