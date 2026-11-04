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

import {HttpClient, HttpHeaders} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {BaseApiService, ConfigService, InterceptorSkip} from '@valtimo/shared';
import {Observable} from 'rxjs';
import {ListField, ListHiddenColumn} from '@valtimo/components';
import {CaseListContext} from '../models';

@Injectable({
  providedIn: 'root',
})
export class CaseListHiddenColumnsService extends BaseApiService {
  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public getHiddenColumns(context: CaseListContext): Observable<ListField[]> {
    return this.httpClient.get<ListField[]>(this.getHiddenColumnsUrl(context), {
      headers:
        context.type === 'group'
          ? new HttpHeaders().set(InterceptorSkip, '403,404')
          : new HttpHeaders(),
    });
  }

  public saveHiddenColumns(
    context: CaseListContext,
    hiddenColumns: ListHiddenColumn[]
  ): Observable<ListHiddenColumn[]> {
    return this.httpClient.post<ListHiddenColumn[]>(
      this.getHiddenColumnsUrl(context),
      hiddenColumns
    );
  }

  private getHiddenColumnsUrl(context: CaseListContext): string {
    return this.getApiUrl(
      context.type === 'group'
        ? `v1/case-definition-group/${context.key}/hidden-list-column`
        : `v1/case/${context.key}/hidden-list-column`
    );
  }
}
