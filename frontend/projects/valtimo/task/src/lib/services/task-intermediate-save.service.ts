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

import {Injectable} from '@angular/core';
import {HttpClient, HttpHeaders, HttpParams, HttpResponse} from '@angular/common/http';
import {Observable} from 'rxjs';
import {
  AssigneeRequest,
  IntermediateSaveRequest,
  IntermediateSubmission,
  SpecifiedTask,
  Task,
  TaskListColumn,
  TaskPageParams,
  TaskProcessLinkResult,
} from '../models';
import {
  BaseApiService,
  ConfigService,
  CustomTaskList,
  NamedUser,
  Page,
  TaskListTab,
} from '@valtimo/config';
import {InterceptorSkip} from '@valtimo/security';

@Injectable({providedIn: 'root'})
export class TaskIntermediateSaveService extends BaseApiService {
  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public getIntermediateSubmission(taskInstanceId: string): Observable<IntermediateSubmission> {
    return this.httpClient.get<IntermediateSubmission>(
      this.getApiUrl('/v1/form/intermediate/submission'),
      {
        params: {
          taskInstanceId,
        },
        headers: new HttpHeaders().set(InterceptorSkip, '404'),
      }
    );
  }

  public storeIntermediateSubmission(
    request: IntermediateSaveRequest
  ): Observable<IntermediateSubmission> {
    return this.httpClient.post<IntermediateSubmission>(
      this.getApiUrl('/v1/form/intermediate/submission'),
      request,
      {
        headers: new HttpHeaders().set(InterceptorSkip, '400'),
      }
    );
  }

  public clearIntermediateSubmission(taskInstanceId: string): Observable<void> {
    return this.httpClient.delete<void>(this.getApiUrl('/v1/form/intermediate/submission'), {
      params: {
        taskInstanceId,
      },
    });
  }
}
