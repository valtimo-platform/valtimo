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

import {Injectable} from '@angular/core';
import {BaseApiService, ConfigService} from '@valtimo/shared';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {CaseZakenApiSync, CaseZakenApiSyncRequest, RoltypeOption} from '../models';

@Injectable({
  providedIn: 'root',
})
export class CaseZakenApiSyncService extends BaseApiService {
  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public getCaseZakenApiSync(
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string
  ): Observable<CaseZakenApiSync> {
    return this.httpClient.get<CaseZakenApiSync>(
      this.getApiUrl(
        `/management/v1/case-definition/${caseDefinitionKey}/version/${caseDefinitionVersionTag}/zaken-api-sync`
      )
    );
  }

  public updateCaseZakenApiSync(
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string,
    request: CaseZakenApiSyncRequest
  ): Observable<void> {
    return this.httpClient.put<void>(
      this.getApiUrl(
        `/management/v1/case-definition/${caseDefinitionKey}/version/${caseDefinitionVersionTag}/zaken-api-sync`
      ),
      request
    );
  }

  public deleteCaseZakenApiSync(
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string
  ): Observable<void> {
    return this.httpClient.delete<void>(
      this.getApiUrl(
        `/management/v1/case-definition/${caseDefinitionKey}/version/${caseDefinitionVersionTag}/zaken-api-sync`
      )
    );
  }

  public getAvailableRoltypes(
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string
  ): Observable<RoltypeOption[]> {
    return this.httpClient.get<RoltypeOption[]>(
      this.getApiUrl(`/v1/case-definition/${caseDefinitionKey}/zaaktype/roltype`),
      {params: {caseDefinitionVersionTag}}
    );
  }
}
