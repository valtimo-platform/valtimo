/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

import {HttpClient, HttpHeaders} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {BaseApiService, ConfigService, InterceptorSkip} from '@valtimo/shared';
import {Observable} from 'rxjs';
import {BasicWidget} from '@valtimo/layout';

@Injectable({providedIn: 'root'})
export class CaseHeaderWidgetApiService extends BaseApiService {
  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public getHeaderWidget(documentId: string): Observable<BasicWidget> {
    return this.httpClient.get<BasicWidget>(this.getApiUrl(`v1/case/${documentId}/header-widget`), {
      headers: new HttpHeaders().set(InterceptorSkip, '204'),
    });
  }
}
