/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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

import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {
  CarbonListItem,
  CarbonListModule,
  ColumnConfig,
  DEFAULT_PAGINATION,
  Pagination,
  ViewType,
} from '@valtimo/components';
import {Page} from '@valtimo/config';
import {
  BehaviorSubject,
  combineLatest,
  map,
  Observable,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {LOG_TOOLTIP_LIMIT, LoggingEvent} from '../../models';
import {LoggingApiService} from '../../services';
import {LogDetailsComponent} from '../log-details/log-details.component';

@Component({
  templateUrl: './logging-list.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule, CarbonListModule, LogDetailsComponent],
  providers: [LoggingApiService],
})
export class LoggingListComponent implements OnInit, OnDestroy {
  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly logItems$: Observable<CarbonListItem> = this.activatedRoute.queryParamMap.pipe(
    tap(() => this.loading$.next(true)),
    switchMap(queryParams => this.loggingApiService.getTechnicalLogs(queryParams['params'])),
    map((loggingPage: Page<LoggingEvent>) => {
      this.pagination$.next({
        ...this.pagination$.getValue(),
        collectionSize: loggingPage.totalElements,
      });

      return loggingPage.content;
    }),

    tap(() => {
      this.loading$.next(false);
    })
  );

  public readonly pagination$ = new BehaviorSubject<Pagination>(DEFAULT_PAGINATION);
  public readonly selectedLogEvent$ = new BehaviorSubject<LoggingEvent | null>(null);

  public readonly FIELDS: ColumnConfig[] = [
    {
      key: 'timestamp',
      label: 'logging.columns.timestamp',
      viewType: ViewType.DATE_TIME,
    },
    {
      key: 'level',
      label: 'logging.columns.level',
      viewType: ViewType.TEXT,
    },
    {
      key: 'formattedMessage',
      label: 'logging.columns.formattedMessage',
      viewType: ViewType.TEXT,
      tooltipCharLimit: LOG_TOOLTIP_LIMIT,
    },
  ];

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly activatedRoute: ActivatedRoute,
    private readonly loggingApiService: LoggingApiService,
    private readonly router: Router
  ) {}

  public ngOnInit(): void {
    this.setInitialParams();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onCloseModalEvent(): void {
    this.selectedLogEvent$.next(null);
  }

  public onPaginationClicked(page: number): void {
    this.pagination$.next({...this.pagination$.getValue(), page});
  }

  public onPaginationSet(size: number): void {
    const {collectionSize, page} = this.pagination$.getValue();
    const resetPage: boolean = Math.ceil(+collectionSize / size) <= +page && +collectionSize > 0;

    this.pagination$.next({...this.pagination$.getValue(), size, ...(resetPage && {page: 1})});
  }

  public onRowClickedEvent(rowClickEvent: LoggingEvent & {ctrlClick: boolean}): void {
    const {ctrlClick: _, ...logEvent} = rowClickEvent;
    this.selectedLogEvent$.next(logEvent);
  }

  private setInitialParams(): void {
    this.activatedRoute.queryParamMap
      .pipe(
        take(1),
        map(queryParams => {
          const {size, page} = queryParams['params'];
          return {size, page};
        })
      )
      .subscribe(({size, page}) => {
        this.pagination$.next({
          ...this.pagination$.getValue(),
          size: +size,
          page: +(page ?? 0) + 1,
        });
        this.openQueryParamsSubscription();
      });
  }

  private openQueryParamsSubscription(): void {
    this._subscriptions.add(
      //combineLatest for later filtering
      combineLatest([this.pagination$]).subscribe(([pagination]) => {
        const {size, page} = pagination;
        this.router.navigate(['/logging'], {queryParams: {size, page: page - 1}});
      })
    );
  }
}
