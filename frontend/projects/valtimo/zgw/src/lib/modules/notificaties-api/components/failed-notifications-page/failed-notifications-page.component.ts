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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component} from '@angular/core';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  CarbonListModule,
  CarbonTag,
  ColumnConfig,
  DEFAULT_PAGINATION,
  Pagination,
  ViewType,
} from '@valtimo/components';
import {BehaviorSubject, Observable, tap, switchMap, finalize, map} from 'rxjs';
import {FailedNotification, FailedNotificationPageRequest} from '../../models';
import {FailedNotificationsService} from '../../services';
import {FailedNotificationDetailComponent} from '../failed-notification-detail/failed-notification-detail.component';
import {ToastrService} from 'ngx-toastr';

@Component({
  selector: 'valtimo-notificaties-api-failed-notifications-page',
  templateUrl: './failed-notifications-page.component.html',
  styleUrls: ['./failed-notifications-page.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    CarbonListModule,
    FailedNotificationDetailComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FailedNotificationsPageComponent {
  private readonly defaultSort = 'receivedAt,desc';

  public readonly loading$ = new BehaviorSubject<boolean>(false);
  public readonly pagination$ = new BehaviorSubject<Pagination>({...DEFAULT_PAGINATION});
  public readonly retryInProgress$ = new BehaviorSubject<boolean>(false);
  public readonly selectedNotification$ = new BehaviorSubject<FailedNotification | null>(null);

  private readonly pageRequest$ = new BehaviorSubject<FailedNotificationPageRequest>({
    page: 0,
    size: DEFAULT_PAGINATION.size,
    sort: this.defaultSort,
  });

  public readonly notifications$: Observable<FailedNotification[]> = this.pageRequest$.pipe(
    tap(() => this.loading$.next(true)),
    switchMap(request =>
      this.failedNotificationsService.getFailedNotifications(request).pipe(
        tap(page => {
          this.pagination$.next({
            ...this.pagination$.getValue(),
            page: request.page + 1,
            size: request.size,
            collectionSize: page.totalElements,
          });
        }),
        map(page => page.content),
        finalize(() => this.loading$.next(false))
      )
    )
  );

  public readonly FIELDS: ColumnConfig[] = [
    {
      key: 'receivedAt',
      label: 'zgw.notifications.failed.columns.receivedAt',
      viewType: ViewType.DATE_TIME,
    },
    {
      key: 'idempotenceKey',
      label: 'zgw.notifications.failed.columns.idempotenceKey',
      viewType: ViewType.TEXT,
    },
    {
      key: 'pendingRetries',
      label: 'zgw.notifications.failed.columns.pendingRetries',
      viewType: ViewType.NUMBER,
    },
    {
      key: 'lastProcessedAt',
      label: 'zgw.notifications.failed.columns.lastProcessedAt',
      viewType: ViewType.DATE_TIME,
    },
    {
      key: 'lastErrorMessage',
      label: 'zgw.notifications.failed.columns.lastErrorMessage',
      viewType: ViewType.TEXT,
      tooltipCharLimit: 160,
    },
  ];

  constructor(
    private readonly failedNotificationsService: FailedNotificationsService,
    private readonly toastrService: ToastrService,
    private readonly translateService: TranslateService
  ) {}

  public onPaginationClicked(page: number): void {
    const current = this.pageRequest$.getValue();
    this.pageRequest$.next({...current, page: Math.max(0, page - 1)});
  }

  public onPaginationSet(size: number): void {
    const current = this.pageRequest$.getValue();
    const updated: FailedNotificationPageRequest = {
      ...current,
      size,
      page: 0,
    };
    this.pageRequest$.next(updated);
  }

  public onRowClicked(
    row: FailedNotification & {ctrlClick: boolean; tags: CarbonTag[]}
  ): void {
    const {ctrlClick: _ctrl, tags: _tags, ...notification} = row;
    this.selectedNotification$.next(notification);
  }

  public onCloseModal(): void {
    this.selectedNotification$.next(null);
  }

  public onRetry(): void {
    const notification = this.selectedNotification$.getValue();

    if (!notification) {
      return;
    }

    this.retryInProgress$.next(true);

    this.failedNotificationsService
      .retryFailedNotification(notification.id)
      .pipe(finalize(() => this.retryInProgress$.next(false)))
      .subscribe({
      next: () => {
        const message = this.translateService.instant(
          'zgw.notifications.failed.retrySuccess'
        );
        this.toastrService.success(message);
        this.selectedNotification$.next(null);
        this.pageRequest$.next({...this.pageRequest$.getValue()});
      },
      error: () => {
        const message = this.translateService.instant('zgw.notifications.failed.retryError');
        this.toastrService.error(message);
      },
      });
  }
}
