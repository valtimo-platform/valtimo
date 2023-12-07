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

import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {AssigneeRequest, Task, TaskProcessLinkResult} from './models';
import {ConfigService, CustomTaskList, NamedUser} from '@valtimo/config';
import {InterceptorSkip} from '@valtimo/security';

@Injectable({providedIn: 'root'})
export class TaskService {
  private valtimoEndpointUri: string;

  constructor(
    private http: HttpClient,
    private readonly configService: ConfigService
  ) {
    this.valtimoEndpointUri = configService.config.valtimoApi.endpointUri;
  }

  queryTasks(params?: any): Observable<any> {
    return this.http.get(`${this.valtimoEndpointUri}v1/task`, {observe: 'response', params});
  }

  getTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.valtimoEndpointUri}v1/task?filter=all`);
  }

  getTask(id: string): Observable<any> {
    return this.http.get(this.valtimoEndpointUri + 'v1/task/' + id);
  }

  getCandidateUsers(id: string): Observable<NamedUser[]> {
    return this.http.get<NamedUser[]>(
      this.valtimoEndpointUri + 'v2/task/' + id + '/candidate-user'
    );
  }

  assignTask(id: string, assigneeRequest: AssigneeRequest): Observable<any> {
    return this.http.post(this.valtimoEndpointUri + 'v1/task/' + id + '/assign', assigneeRequest);
  }

  unassignTask(id: string): Observable<any> {
    return this.http.post(this.valtimoEndpointUri + 'v1/task/' + id + '/unassign', null);
  }

  completeTask(id: string, variables: Map<string, any>): Observable<any> {
    return this.http.post(this.valtimoEndpointUri + 'v1/task/' + id + '/complete', {
      variables,
      filesToDelete: [],
    });
  }

  getTaskProcessLink(taskId: string): Observable<TaskProcessLinkResult> {
    return this.http.get<TaskProcessLinkResult>(
      `${this.valtimoEndpointUri}v2/process-link/task/${taskId}`,
      {
        headers: {[InterceptorSkip]: ''},
      }
    );
  }

  getTaskProcessLinkV1(taskId: string): Observable<TaskProcessLinkResult> {
    return this.http.get<TaskProcessLinkResult>(
      `${this.valtimoEndpointUri}v1/process-link/task/${taskId}`
    );
  }

  getConfigCustomTaskList(): CustomTaskList {
    return this.configService.config.customTaskList;
  }
}
