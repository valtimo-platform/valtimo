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
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {HttpClient, HttpParams} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {BaseApiService, ConfigService, Page} from '@valtimo/config';
import {Observable, map} from 'rxjs';
import {FailedNotification, FailedNotificationPageRequest} from '../models';

@Injectable({
  providedIn: 'root',
})
export class FailedNotificationsService extends BaseApiService {
  constructor(
    protected override readonly httpClient: HttpClient,
    protected override readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public getFailedNotifications(
    request: FailedNotificationPageRequest
  ): Observable<Page<FailedNotification>> {
    const params = new HttpParams({
      fromObject: {
        page: request.page,
        size: request.size,
        ...(request.sort ? {sort: request.sort} : {}),
      } as any,
    });

    return this.httpClient.get<Page<FailedNotification>>(
      this.getApiUrl('management/v1/notificatiesapi/inbound-events/failed'),
      {params}
    );
  }

  public retryFailedNotification(id: string): Observable<void> {
    return this.httpClient.post<void>(
      this.getApiUrl(`management/v1/notificatiesapi/inbound-events/${id}/retry`),
      {}
    );
  }

  public getFailedNotificationCount(): Observable<number> {
    return this.httpClient
      .get<{count: number}>(
        this.getApiUrl('management/v1/notificatiesapi/inbound-events/failed/count')
      )
      .pipe(map(response => response.count ?? 0));
  }
}
