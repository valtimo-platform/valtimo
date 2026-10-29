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
import {BaseApiService, CaseManagementParams, ConfigService} from '@valtimo/shared';
import {Observable} from 'rxjs';
import {
  CaseConfigurationItem,
  CreateCaseConfigurationRequest,
  SetCaseConfigurationEnvironmentValueRequest,
  UpdateCaseConfigurationRequest,
} from '../models';

@Injectable({
  providedIn: 'root',
})
export class CaseConfigurationApiService extends BaseApiService {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly httpClient: HttpClient
  ) {
    super(httpClient, configService);
  }

  public getConfigurations(params: CaseManagementParams): Observable<CaseConfigurationItem[]> {
    return this.httpClient.get<CaseConfigurationItem[]>(this.getConfigurationUrl(params));
  }

  public createConfiguration(
    params: CaseManagementParams,
    request: CreateCaseConfigurationRequest
  ): Observable<CaseConfigurationItem> {
    return this.httpClient.post<CaseConfigurationItem>(this.getConfigurationUrl(params), request);
  }

  public updateConfiguration(
    params: CaseManagementParams,
    configurationKey: string,
    request: UpdateCaseConfigurationRequest
  ): Observable<CaseConfigurationItem> {
    return this.httpClient.put<CaseConfigurationItem>(
      this.getConfigurationKeyUrl(params, configurationKey),
      request
    );
  }

  public deleteConfiguration(
    params: CaseManagementParams,
    configurationKey: string
  ): Observable<void> {
    return this.httpClient.delete<void>(this.getConfigurationKeyUrl(params, configurationKey));
  }

  public setEnvironmentValue(
    params: CaseManagementParams,
    configurationKey: string,
    request: SetCaseConfigurationEnvironmentValueRequest
  ): Observable<CaseConfigurationItem> {
    return this.httpClient.put<CaseConfigurationItem>(
      `${this.getConfigurationKeyUrl(params, configurationKey)}/environment-value`,
      request
    );
  }

  public clearEnvironmentValue(
    params: CaseManagementParams,
    configurationKey: string
  ): Observable<void> {
    return this.httpClient.delete<void>(
      `${this.getConfigurationKeyUrl(params, configurationKey)}/environment-value`
    );
  }

  private getConfigurationUrl(params: CaseManagementParams): string {
    return this.getApiUrl(
      `management/v1/case-definition/${params.caseDefinitionKey}/version/${params.caseDefinitionVersionTag}/configuration`
    );
  }

  private getConfigurationKeyUrl(params: CaseManagementParams, configurationKey: string): string {
    return `${this.getConfigurationUrl(params)}/${encodeURIComponent(configurationKey)}`;
  }
}
