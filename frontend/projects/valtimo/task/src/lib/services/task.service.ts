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
import {HttpClient, HttpParams, HttpResponse} from '@angular/common/http';
import {Observable} from 'rxjs';
import {
  AssigneeRequest,
  SpecifiedTask,
  Task,
  TaskListColumn,
  TaskListOtherFilters,
  TaskListSearchField,
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
export class TaskService extends BaseApiService {
  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public queryTasks(params?: any): Observable<HttpResponse<Array<Task>>> {
    return this.httpClient.get<Array<Task>>(this.getApiUrl('/v1/task'), {
      observe: 'response',
      params,
    });
  }

  public queryTasksPage(params?: any): Observable<Page<Task>> {
    return this.httpClient.get<Page<Task>>(this.getApiUrl('/v2/task'), {
      params,
    });
  }

  public queryTasksPageV3(
    assigneeFilter: TaskListTab = TaskListTab.ALL,
    pageParams: TaskPageParams,
    caseDefinitionName?: string,
    otherFilters?: TaskListOtherFilters
  ): Observable<Page<Task> | Page<SpecifiedTask>> {
    let httpParams = new HttpParams().set('page', pageParams.page).set('size', pageParams.size);

    if (pageParams.sort) {
      httpParams = httpParams.append('sort', pageParams.sort);
    }

    if (caseDefinitionName && (otherFilters || []).length > 0) {
      return this.searchTasks(httpParams, caseDefinitionName, otherFilters, assigneeFilter);
    }

    httpParams = httpParams.append('filter', assigneeFilter.toUpperCase());

    return this.httpClient.post<Page<Task>>(
      this.getApiUrl('/v3/task'),
      {...(caseDefinitionName && {caseDefinitionName})},
      {params: httpParams}
    );
  }

  private searchTasks(
    params: HttpParams,
    caseDefinitionName: string,
    otherFilters: TaskListOtherFilters,
    assigneeFilter: TaskListTab = TaskListTab.ALL
  ): Observable<Page<SpecifiedTask>> {
    return this.httpClient.post<Page<SpecifiedTask>>(
      this.getApiUrl(`/v1/document-definition/${caseDefinitionName}/task/search`),
      {
        caseDefinitionName,
        assigneeFilter: assigneeFilter.toUpperCase(),
        ...(otherFilters && {otherFilters}),
      },
      {params}
    );
  }

  public getTasks(): Observable<Task[]> {
    return this.httpClient.get<Task[]>(this.getApiUrl('/v1/task?filter=all`'));
  }

  public getTask(id: string): Observable<any> {
    return this.httpClient.get(this.getApiUrl(`/v1/task/${id}`));
  }

  public getCandidateUsers(id: string): Observable<NamedUser[]> {
    return this.httpClient.get<NamedUser[]>(this.getApiUrl(`/v2/task/${id}/candidate-user`));
  }

  public assignTask(id: string, assigneeRequest: AssigneeRequest): Observable<any> {
    return this.httpClient.post(this.getApiUrl(`/v1/task/${id}/assign`), assigneeRequest);
  }

  public unassignTask(id: string): Observable<any> {
    return this.httpClient.post(this.getApiUrl(`/v1/task/${id}/unassign`), null);
  }

  public completeTask(id: string, variables: Map<string, any>): Observable<any> {
    return this.httpClient.post(this.getApiUrl(`/v1/task/${id}/complete`), {
      variables,
      filesToDelete: [],
    });
  }

  public getTaskProcessLink(taskId: string): Observable<TaskProcessLinkResult> {
    return this.httpClient.get<TaskProcessLinkResult>(
      this.getApiUrl(`/v2/process-link/task/${taskId}`),
      {
        headers: {[InterceptorSkip]: '404'},
      }
    );
  }

  public getTaskListColumns(caseDefinitionName: string): Observable<TaskListColumn[]> {
    return this.httpClient.get<TaskListColumn[]>(
      this.getApiUrl(`/v1/case/${caseDefinitionName}/task-list-column`)
    );
  }

  public getConfigCustomTaskList(): CustomTaskList {
    return this.configService.config.customTaskList;
  }

  public getTaskListSearchFields(caseDefinitionName: string): Observable<TaskListSearchField[]> {
    return this.httpClient.get<TaskListSearchField[]>(
      this.getApiUrl(`v1/search/field/TaskListSearchColumns/${caseDefinitionName}`)
    );
  }
}
