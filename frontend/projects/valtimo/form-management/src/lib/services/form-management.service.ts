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

import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {
  CreateFormDefinitionRequest,
  FormDefinition,
  ModifyFormDefinitionRequest,
  QueryFormsResponse,
} from '../models';
import {Observable, of} from 'rxjs';
import {BaseApiService, ConfigService} from '@valtimo/shared';

@Injectable({
  providedIn: 'root',
})
export class FormManagementService extends BaseApiService {
  private valtimoApiConfig: any;

  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public getFormDefinition(formDefinitionId: string): Observable<FormDefinition> {
    return this.httpClient.get<FormDefinition>(
      this.getApiUrl(`/management/v1/form/${formDefinitionId}`)
    );
  }

  public getFormDefinitionCase(
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string,
    formDefinitionId: string
  ): Observable<FormDefinition> {
    return this.httpClient.get<FormDefinition>(
      this.getApiUrl(
        `/management/v1/case-definition/${caseDefinitionKey}/version/${caseDefinitionVersionTag}/form/${formDefinitionId}`
      )
    );
  }

  public existsFormDefinition(formDefinitionName: string): Observable<boolean> {
    if (!formDefinitionName) return of(false);

    return this.httpClient.get<boolean>(
      this.getApiUrl(`/management/v1/form/exists/${formDefinitionName}`)
    );
  }

  public existsFormDefinitionCase(
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string,
    formDefinitionName: string
  ): Observable<boolean> {
    if (!formDefinitionName) return of(false);

    return this.httpClient.get<boolean>(
      this.getApiUrl(
        `management/v1/case-definition/${caseDefinitionKey}/version/${caseDefinitionVersionTag}/form/${formDefinitionName}/exists`
      )
    );
  }

  public queryFormDefinitions(params?: any): Observable<QueryFormsResponse> {
    return this.httpClient.get<QueryFormsResponse>(this.getApiUrl(`/management/v1/form`), {
      params,
    });
  }

  public queryFormDefinitionsCase(
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string,
    params?: any
  ): Observable<QueryFormsResponse> {
    return this.httpClient.get<QueryFormsResponse>(
      this.getApiUrl(
        `/management/v1/case-definition/${caseDefinitionKey}/version/${caseDefinitionVersionTag}/form`
      ),
      {
        params,
      }
    );
  }

  public createFormDefinition(request: CreateFormDefinitionRequest): Observable<FormDefinition> {
    return this.httpClient.post<FormDefinition>(this.getApiUrl(`/management/v1/form`), request);
  }

  public createFormDefinitionsCase(
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string,
    request: CreateFormDefinitionRequest
  ): Observable<FormDefinition> {
    return this.httpClient.post<FormDefinition>(
      this.getApiUrl(
        `/management/v1/case-definition/${caseDefinitionKey}/version/${caseDefinitionVersionTag}/form`
      ),
      request
    );
  }

  public modifyFormDefinition(request: ModifyFormDefinitionRequest): Observable<FormDefinition> {
    return this.httpClient.put<FormDefinition>(this.getApiUrl(`/management/v1/form/`), request);
  }

  public modifyFormDefinitionCase(
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string,
    request: ModifyFormDefinitionRequest
  ): Observable<FormDefinition> {
    return this.httpClient.put<FormDefinition>(
      this.getApiUrl(
        `/management/v1/case-definition/${caseDefinitionKey}/version/${caseDefinitionVersionTag}/form`
      ),
      request
    );
  }

  public deleteFormDefinition(formDefinitionId: string): Observable<void> {
    return this.httpClient.delete<void>(this.getApiUrl(`/management/v1/form/${formDefinitionId}`));
  }

  public deleteFormDefinitionCase(
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string,
    formDefinitionId: string
  ): Observable<void> {
    return this.httpClient.delete<void>(
      this.getApiUrl(
        `/management/v1/case-definition/${caseDefinitionKey}/version/${caseDefinitionVersionTag}/form/${formDefinitionId}`
      )
    );
  }
}
