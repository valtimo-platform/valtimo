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
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {Observable} from 'rxjs';
import {BaseApiService, ConfigService, InterceptorSkip} from '@valtimo/shared';
import {Decision, DecisionXml} from '../models';

@Injectable({
  providedIn: 'root',
})
export class DecisionService extends BaseApiService {
  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public deployDmn(dmn: File): Observable<{identifier: string}> {
    const formData: FormData = new FormData();
    formData.append('file', dmn);
    formData.append('deployment-name', 'dmnTableDeploy');
    formData.append('deployment-source', 'process application');

    return this.httpClient.post<{identifier: string}>(
      this.getApiUrl('/v1/process/definition/deployment'),
      formData
    );
  }

  public getDecisions(): Observable<Decision[]> {
    return this.httpClient.get<Decision[]>(
      this.getApiUrl('/operaton-rest/engine/default/decision-definition')
    );
  }

  public getDecisionById(decisionId: string): Observable<Decision> {
    return this.httpClient.get<Decision>(
      this.getApiUrl(`/operaton-rest/engine/default/decision-definition/${decisionId}`)
    );
  }

  public getLatestDecisionByKey(decisionKey: string): Observable<Decision> {
    return this.httpClient.get<Decision>(
      this.getApiUrl(`/operaton-rest/engine/default/decision-definition/key/${decisionKey}`)
    );
  }

  public getDecisionXml(decisionId: string): Observable<DecisionXml> {
    return this.httpClient.get<DecisionXml>(
      this.getApiUrl(`/operaton-rest/engine/default/decision-definition/${decisionId}/xml`)
    );
  }

  public listCaseDecisionDefinitions(
    caseDefinitionKey: string,
    versionTag: string
  ): Observable<Decision[]> {
    return this.httpClient.get<Decision[]>(
      this.getApiUrl(
        `/management/v1/case-definition/${caseDefinitionKey}/version/${versionTag}/decision-definition`
      )
    );
  }

  public deployCaseDecisionDefinition(
    caseDefinitionKey: string,
    versionTag: string,
    dmn: File
  ): Observable<{identifier: string}> {
    const formData = new FormData();
    formData.append('file', dmn);

    return this.httpClient.post<{identifier: string}>(
      this.getApiUrl(
        `/management/v1/case-definition/${caseDefinitionKey}/version/${versionTag}/decision-definition`
      ),
      formData,
      {
        headers: new HttpHeaders().set(InterceptorSkip, '204'),
      }
    );
  }

  public deleteCaseDecisionDefinition(
    caseDefinitionKey: string,
    versionTag: string,
    decisionDefinitionKey: string
  ): Observable<any> {
    return this.httpClient.delete<any>(
      this.getApiUrl(
        `/management/v1/case-definition/${caseDefinitionKey}/version/${versionTag}/decision-definition/${decisionDefinitionKey}`
      )
    );
  }
}
