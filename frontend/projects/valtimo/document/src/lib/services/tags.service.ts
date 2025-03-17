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
import {CaseTag} from '../models';

@Injectable({
  providedIn: 'root',
})
export class CaseTagService extends BaseApiService {
  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public getCaseTagsManagement(caseDefinitionName: string): Observable<CaseTag[]> {
    return this.httpClient.get<CaseTag[]>(
      this.getApiUrl(`/management/v1/case-definition/${caseDefinitionName}/case-tag`)
    );
  }

  public getCaseTags(caseDefinitionName: string): Observable<CaseTag[]> {
    return this.httpClient.get<CaseTag[]>(
      this.getApiUrl(`/v1/case-definition/${caseDefinitionName}/case-tag`)
    );
  }

  public saveCaseTag(caseDefinitionName: string, tag: CaseTag): Observable<CaseTag> {
    return this.httpClient.post<CaseTag>(
      this.getApiUrl(`/management/v1/case-definition/${caseDefinitionName}/case-tag`),
      tag
    );
  }

  public updateCaseTag(
    caseDefinitionName: string,
    currentTag: string,
    updatedTag: CaseTag
  ): Observable<CaseTag> {
    return this.httpClient.put<CaseTag>(
      this.getApiUrl(`/management/v1/case-definition/${caseDefinitionName}/case-tag/${currentTag}`),
      updatedTag
    );
  }

  public deleteCaseTag(caseDefinitionName: string, tag: string): Observable<void> {
    return this.httpClient.delete<void>(
      this.getApiUrl(`/management/v1/case-definition/${caseDefinitionName}/case-tag/${tag}`)
    );
  }

  public updateCaseTags(
    caseDefinitionName: string,
    reorderedStatus: CaseTag[]
  ): Observable<CaseTag[]> {
    return this.httpClient.put<CaseTag[]>(
      this.getApiUrl(`/management/v1/case-definition/${caseDefinitionName}/case-tag`),
      reorderedStatus
    );
  }
}
