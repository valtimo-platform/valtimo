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

import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {ConfigService, Page, BaseApiService} from '@valtimo/shared';
import {BehaviorSubject, catchError, Observable, of, switchMap, take, tap} from 'rxjs';
import {FormFlowDefinition, FormFlowDefinitionId, ListFormFlowDefinition} from '../models';

@Injectable({
  providedIn: 'root',
})
export class FormFlowService extends BaseApiService {
  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public getFormFlowDefinitions(
    caseDefinitionKey: string,
    caseVersionTag: string
  ): Observable<Page<ListFormFlowDefinition>> {
    return this.httpClient.get<Page<ListFormFlowDefinition>>(
      this.getApiUrl(
        `management/v1/case-definition/${caseDefinitionKey}/version/${caseVersionTag}/form-flow-definition`
      )
    );
  }

  public getFormFlowDefinitionByKey(
    caseDefinitionKey: string,
    caseVersionTag: string,
    formFlowDefinitionKey: string
  ): Observable<FormFlowDefinition> {
    return this.httpClient.get<FormFlowDefinition>(
      this.getApiUrl(
        `management/v1/case-definition/${caseDefinitionKey}/version/${caseVersionTag}/form-flow-definition/${formFlowDefinitionKey}`
      )
    );
  }

  public createFormFlowDefinition(
    caseDefinitionKey: string,
    caseVersionTag: string,
    definition: FormFlowDefinition
  ): Observable<FormFlowDefinition> {
    return this.httpClient.post<FormFlowDefinition>(
      this.getApiUrl(
        `management/v1/case-definition/${caseDefinitionKey}/version/${caseVersionTag}/form-flow-definition`
      ),
      definition
    );
  }

  public deleteFormFlowDefinition(
    caseDefinitionKey: string,
    caseVersionTag: string,
    definitionKey: string
  ): Observable<null> {
    return this.httpClient.delete<null>(
      this.getApiUrl(
        `management/v1/case-definition/${caseDefinitionKey}/version/${caseVersionTag}/form-flow-definition/${definitionKey}`
      )
    );
  }

  public updateFormFlowDefinition(
    caseDefinitionKey: string,
    caseVersionTag: string,
    definitionKey: string,
    updatedDefinition: FormFlowDefinition
  ): Observable<FormFlowDefinition> {
    return this.httpClient.put<FormFlowDefinition>(
      this.getApiUrl(
        `management/v1/case-definition/${caseDefinitionKey}/version/${caseVersionTag}/form-flow-definition/${definitionKey}`
      ),
      updatedDefinition
    );
  }
}
