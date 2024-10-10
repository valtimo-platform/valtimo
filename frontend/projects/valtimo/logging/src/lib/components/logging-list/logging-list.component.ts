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
import {Filter16, TrashCan16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';
import {
  CARBON_CONSTANTS,
  CarbonListItem,
  CarbonListModule,
  ColumnConfig,
  DEFAULT_PAGINATION,
  Pagination,
  ViewType,
} from '@valtimo/components';
import {Page} from '@valtimo/config';
import {
  ButtonModule,
  DialogModule,
  DropdownModule,
  IconModule,
  IconService,
} from 'carbon-components-angular';
import {
  BehaviorSubject,
  combineLatest,
  map,
  Observable,
  startWith,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {
  LOG_ELLIPSIS_LIMIT,
  LOG_LEVEL_TAG,
  LoggingEvent,
  LoggingEventProperty,
  LoggingEventQueryParams,
  LoggingEventSearchRequest,
} from '../../models';
import {LoggingApiService} from '../../services';
import {LogDetailsComponent} from '../log-details/log-details.component';
import {LogSearchComponent} from '../log-search/log-search.component';

@Component({
  templateUrl: './logging-list.component.html',
  styleUrl: './logging-list.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ButtonModule,
    CarbonListModule,
    DialogModule,
    DropdownModule,
    IconModule,
    LogDetailsComponent,
    LogSearchComponent,
  ],
  providers: [LoggingApiService],
})
export class LoggingListComponent implements OnInit, OnDestroy {
  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly logItems$: Observable<CarbonListItem> = this.activatedRoute.queryParamMap.pipe(
    tap(() => this.loading$.next(true)),
    switchMap(queryParams =>
      this.loggingApiService.getTechnicalLogs({
        ...queryParams['params'],
        ...(!!queryParams['params']?.properties && {
          properties: this.base64ToObject(queryParams['params'].properties),
        }),
      })
    ),
    map((loggingPage: Page<LoggingEvent>) => {
      this.pagination$.next({
        ...this.pagination$.getValue(),
        collectionSize: loggingPage.totalElements,
      });

      return loggingPage.content.map((logEvent: LoggingEvent) => ({
        ...logEvent,
        tags: [
          {
            content: logEvent.level,
            type: LOG_LEVEL_TAG[logEvent.level],
          },
        ],
      }));
    }),
    startWith([]),
    tap(() => {
      this.loading$.next(false);
    })
  );

  public readonly searchRequest$ = new BehaviorSubject<LoggingEventSearchRequest>({});
  public readonly pagination$ = new BehaviorSubject<Pagination>(DEFAULT_PAGINATION);
  public readonly logDetailsOpen$ = new BehaviorSubject<boolean>(false);
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
      viewType: ViewType.TAGS,
    },
    {
      key: 'formattedMessage',
      label: 'logging.columns.formattedMessage',
      viewType: ViewType.TEXT,
      tooltipCharLimit: LOG_ELLIPSIS_LIMIT,
    },
  ];

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly activatedRoute: ActivatedRoute,
    private readonly iconService: IconService,
    private readonly loggingApiService: LoggingApiService,
    private readonly router: Router
  ) {
    this.iconService.registerAll([Filter16, TrashCan16]);
  }

  public ngOnInit(): void {
    this.setInitialParams();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onCloseModalEvent(): void {
    this.logDetailsOpen$.next(false);

    setTimeout(() => {
      this.selectedLogEvent$.next(null);
    }, CARBON_CONSTANTS.modalAnimationMs);
  }

  public onPaginationClicked(page: number, logItems: CarbonListItem[]): void {
    const activePagination: Pagination = this.pagination$.getValue();
    const searchRequest: LoggingEventSearchRequest = this.searchRequest$.getValue();

    if (!searchRequest.beforeTimestamp && activePagination.page === 1)
      this.searchRequest$.next({...searchRequest, beforeTimestamp: logItems[0].timestamp});

    this.pagination$.next({...activePagination, page});
  }

  public onPaginationSet(size: number): void {
    const {collectionSize, page} = this.pagination$.getValue();
    const resetPage: boolean = Math.ceil(+collectionSize / size) <= +page && +collectionSize > 0;

    this.pagination$.next({...this.pagination$.getValue(), size, ...(resetPage && {page: 1})});
  }

  public onRowClickedEvent(rowClickEvent: LoggingEvent & {ctrlClick: boolean}): void {
    const {ctrlClick: _, ...logEvent} = rowClickEvent;
    this.logDetailsOpen$.next(true);
    this.selectedLogEvent$.next(logEvent);
  }

  public onSearchSubmitEvent(searchRequest: LoggingEventSearchRequest): void {
    this.searchRequest$.next(searchRequest);
  }

  public onClearFilter(): void {
    this.onSearchSubmitEvent({});
  }

  private base64ToObject(base64string: string): object {
    return JSON.parse(atob(base64string));
  }

  private objectToBase64(jsObject: object): string {
    return btoa(JSON.stringify(jsObject));
  }

  private openQueryParamsSubscription(): void {
    this._subscriptions.add(
      combineLatest([this.pagination$, this.searchRequest$]).subscribe(
        ([pagination, searchRequest]) => {
          const {size, page} = pagination;

          this.router.navigate(['/logging'], {
            queryParams: {
              size,
              page: page - 1,
              ...{
                ...searchRequest,
                ...(!!searchRequest.properties?.length && {
                  properties: this.objectToBase64(searchRequest.properties),
                }),
              },
            },
          });
        }
      )
    );
  }

  private mapQueryParamsToSearchRequest(
    queryParams: LoggingEventQueryParams
  ): LoggingEventSearchRequest {
    return {
      ...(!!queryParams.likeFormattedMessage && {
        likeFormattedMessage: queryParams.likeFormattedMessage,
      }),
      ...(!!queryParams.level && {level: queryParams.level}),
      ...(!!queryParams.afterTimestamp && {afterTimestamp: queryParams.afterTimestamp}),
      ...(!!queryParams.beforeTimestamp && {beforeTimestamp: queryParams.beforeTimestamp}),
      ...(!!queryParams.properties && {
        properties: this.base64ToObject(queryParams.properties) as Array<LoggingEventProperty>,
      }),
    };
  }

  private setInitialParams(): void {
    this.activatedRoute.queryParamMap
      .pipe(
        take(1),
        map(queryParams => {
          const {size, page, ...searchRequest} = queryParams['params'];
          return {size, page, searchRequest};
        })
      )
      .subscribe(({size, page, searchRequest}) => {
        this.searchRequest$.next(this.mapQueryParamsToSearchRequest(searchRequest));
        this.pagination$.next({
          ...this.pagination$.getValue(),
          size: +size,
          page: +(page ?? 0) + 1,
        });

        this.openQueryParamsSubscription();
      });
  }
}
