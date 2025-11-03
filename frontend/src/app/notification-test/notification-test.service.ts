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

import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {BaseApiService, ConfigService} from '@valtimo/shared';
import {Observable} from 'rxjs';

interface NotificationPayload {
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationTestService extends BaseApiService {
  constructor(
    protected override readonly httpClient: HttpClient,
    protected override readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  sendNotification(message: string): Observable<void> {
    const payload: NotificationPayload = {message};
    return this.httpClient.post<void>(this.getApiUrl('test-impl/notification'), payload);
  }
}
