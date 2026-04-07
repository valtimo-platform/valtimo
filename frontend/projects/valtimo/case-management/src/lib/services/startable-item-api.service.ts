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

import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {
  BaseApiService,
  CaseManagementParams,
  CaseProcessDefinitionResponseDto,
  ConfigService,
} from '@valtimo/shared';
import {Observable} from 'rxjs';
import {
  CreateStartableItemRequest,
  ManagementStartableItem,
  UpdateStartableItemOrderRequest,
} from '../models';

@Injectable({
  providedIn: 'root',
})
export class StartableItemApiService extends BaseApiService {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly httpClient: HttpClient
  ) {
    super(httpClient, configService);
  }

  private getCaseDefinitionUrl(params: CaseManagementParams): string {
    return this.getApiUrl(
      `management/v1/case-definition/${params.caseDefinitionKey}/version/${params.caseDefinitionVersionTag}/startable-item`
    );
  }

  public getItems(params: CaseManagementParams): Observable<ManagementStartableItem[]> {
    return this.httpClient.get<ManagementStartableItem[]>(this.getCaseDefinitionUrl(params));
  }

  public createItem(
    params: CaseManagementParams,
    request: CreateStartableItemRequest
  ): Observable<ManagementStartableItem> {
    return this.httpClient.post<ManagementStartableItem>(
      this.getCaseDefinitionUrl(params),
      request
    );
  }

  public deleteItem(
    params: CaseManagementParams,
    itemKey: string,
    versionTag: string
  ): Observable<void> {
    return this.httpClient.delete<void>(
      `${this.getCaseDefinitionUrl(params)}/${itemKey}/version/${versionTag}`
    );
  }

  public updateOrder(
    params: CaseManagementParams,
    request: UpdateStartableItemOrderRequest
  ): Observable<ManagementStartableItem[]> {
    return this.httpClient.put<ManagementStartableItem[]>(
      `${this.getCaseDefinitionUrl(params)}/order`,
      request
    );
  }

  public getLinkedProcessDefinitions(
    params: CaseManagementParams
  ): Observable<CaseProcessDefinitionResponseDto[]> {
    return this.httpClient.get<CaseProcessDefinitionResponseDto[]>(
      this.getApiUrl(
        `management/v1/case-definition/${params.caseDefinitionKey}/version/${params.caseDefinitionVersionTag}/process-definition`
      )
    );
  }
}
