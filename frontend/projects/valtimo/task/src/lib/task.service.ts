/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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
import {AssigneeRequest, Task, User} from '@valtimo/contract';
import {ConfigService} from '@valtimo/config';

@Injectable({providedIn: 'root'})
export class TaskService {
  private valtimoEndpointUri: string;

  constructor(
    private http: HttpClient,
    configService: ConfigService
  ) {
    this.valtimoEndpointUri = configService.config.valtimoApi.endpointUri;
  }

  queryTasks(params?: any): Observable<any> {
    return this.http.get(`${this.valtimoEndpointUri}task`, {observe: 'response', params: params});
  }

  getTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.valtimoEndpointUri}task?filter=all`);
  }

  getTask(id: string): Observable<any> {
    return this.http.get(this.valtimoEndpointUri + 'task/' + id);
  }

  getCandidateUsers(id: string): Observable<User[]> {
    return this.http.get<User[]>(this.valtimoEndpointUri + 'task/' + id + '/candidate-user');
  }

  assignTask(id: string, assigneeRequest: AssigneeRequest): Observable<any> {
    return this.http.post(this.valtimoEndpointUri + 'task/' + id + '/assign',
      assigneeRequest
    );
  }

  unassignTask(id: string): Observable<any> {
    return this.http.post(this.valtimoEndpointUri + 'task/' + id + '/unassign',
      null
    );
  }

  completeTask(id: string, variables: Map<string, any>): Observable<any> {
    return this.http.post(
      this.valtimoEndpointUri + 'task/' + id + '/complete',
      {
        variables: variables,
        filesToDelete: []
      });
  }

}
