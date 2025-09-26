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

import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {BaseApiService, ConfigService} from '@valtimo/config';
import {TaskListSearchField} from '@valtimo/task';
import {Observable} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class TaskManagementSearchFieldsService extends BaseApiService {
  private _documentDefinitionName: string;

  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public setDocumentDefinitionName(documentDefinitionName: string): void {
    this._documentDefinitionName = documentDefinitionName;
  }

  public getTaskListSearchFields(): Observable<TaskListSearchField[]> {
    return this.httpClient.get<TaskListSearchField[]>(
      this.getApiUrl(`/v1/search/field/TaskListSearchColumns/${this._documentDefinitionName}`)
    );
  }

  public createTaskListSearchField(
    searchField: TaskListSearchField
  ): Observable<TaskListSearchField> {
    return this.httpClient.post<TaskListSearchField>(
      this.getApiUrl(`/v1/search/field/${this._documentDefinitionName}`),
      {
        ...searchField,
        ownerType: 'TaskListSearchColumns',
        ownerId: this._documentDefinitionName,
      }
    );
  }

  public updateTaskListSearchField(
    searchField: TaskListSearchField
  ): Observable<TaskListSearchField> {
    return this.httpClient.put<TaskListSearchField>(
      this.getApiUrl(`/v1/search/field/${this._documentDefinitionName}/${searchField.key}`),
      {
        ...searchField,
        ownerType: 'TaskListSearchColumns',
        ownerId: this._documentDefinitionName,
      }
    );
  }

  public deleteTaskListSearchField(searchFieldKey: string): Observable<void> {
    return this.httpClient.delete<void>(
      this.getApiUrl(
        `/v1/search/field/TaskListSearchColumns/${this._documentDefinitionName}/${searchFieldKey}`
      )
    );
  }

  public orderTaskListSearchFields(searchFields: TaskListSearchField[]): Observable<any[]> {
    return this.httpClient.put<any[]>(
      this.getApiUrl(`/v1/search/field/${this._documentDefinitionName}/fields`),
      searchFields
    );
  }
}
