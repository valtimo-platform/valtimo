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
import {BaseApiService, ConfigService} from '@valtimo/config';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {InternalCaseStatus} from '../models';

@Injectable({
  providedIn: 'root',
})
export class CaseStatusService extends BaseApiService {
  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public getInternalCaseStatusesManagement(
    caseDefinitionName: string
  ): Observable<InternalCaseStatus[]> {
    return this.httpClient.get<InternalCaseStatus[]>(
      this.getApiUrl(`/management/v1/case-definition/${caseDefinitionName}/internal-status`)
    );
  }

  public getInternalCaseStatuses(caseDefinitionName: string): Observable<InternalCaseStatus[]> {
    return this.httpClient.get<InternalCaseStatus[]>(
      this.getApiUrl(`/v1/case-definition/${caseDefinitionName}/internal-status`)
    );
  }

  public saveInternalCaseStatus(
    caseDefinitionName: string,
    status: InternalCaseStatus
  ): Observable<InternalCaseStatus> {
    return this.httpClient.post<InternalCaseStatus>(
      this.getApiUrl(`/management/v1/case-definition/${caseDefinitionName}/internal-status`),
      status
    );
  }

  public deleteInternalCaseStatus(caseDefinitionName: string, statusKey: string): Observable<void> {
    return this.httpClient.delete<void>(
      this.getApiUrl(
        `/management/v1/case-definition/${caseDefinitionName}/internal-status/${statusKey}`
      )
    );
  }

  public updateInternalCaseStatus(
    caseDefinitionName: string,
    currentStatusKey: string,
    updatedStatus: InternalCaseStatus
  ): Observable<InternalCaseStatus> {
    return this.httpClient.put<InternalCaseStatus>(
      this.getApiUrl(
        `/management/v1/case-definition/${caseDefinitionName}/internal-status/${currentStatusKey}`
      ),
      updatedStatus
    );
  }

  public updateInternalCaseStatuses(
    caseDefinitionName: string,
    reorderedStatus: InternalCaseStatus[]
  ): Observable<InternalCaseStatus[]> {
    return this.httpClient.put<InternalCaseStatus[]>(
      this.getApiUrl(`/management/v1/case-definition/${caseDefinitionName}/internal-status`),
      reorderedStatus
    );
  }
}
