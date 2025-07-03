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
import {HttpClient, HttpHeaders, HttpResponse} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {
  BaseApiService,
  ConfigService,
  InterceptorSkip,
  InterceptorSkipHeader,
} from '@valtimo/shared';
import {Page} from '@valtimo/document';
import {map, Observable} from 'rxjs';
import {CaseListItem} from '../models';
import {CaseVersionListItem} from '../models/case-version-list.model';
import {CaseDefinition, DraftVersion} from '../models/case-deployment.model';

@Injectable({
  providedIn: 'root',
})
export class CaseManagementService extends BaseApiService {
  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public getCaseDefinitions(params: any): Observable<Page<CaseListItem>> {
    return this.httpClient.get<Page<CaseListItem>>(
      this.getApiUrl('management/v1/case-definition'),
      {params}
    );
  }

  public getCaseDefinitionVersions(caseDefinitionKey: string): Observable<any[]> {
    return this.httpClient.get<any[]>(
      this.getApiUrl(`management/v1/case-definition/${caseDefinitionKey}/version`),
      {
        params: {size: 100},
      }
    );
  }

  public createDraftVersion(payload: DraftVersion): Observable<any[]> {
    return this.httpClient.post<any[]>(
      this.getApiUrl(`management/v1/case-definition/draft`),
      payload
    );
  }

  public isDraftVersion(
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string
  ): Observable<boolean> {
    return this.httpClient
      .get<CaseDefinition>(
        this.getApiUrl(
          `management/v1/case-definition/${caseDefinitionKey}/version/${caseDefinitionVersionTag}`
        ),
        {
          headers: new HttpHeaders().set(InterceptorSkip, '403'),
        }
      )
      .pipe(map(caseDefinition => !caseDefinition.final));
  }

  public getGlobalActiveCase(caseDefinitionKey: string): Observable<any> {
    return this.httpClient.get<any[]>(
      this.getApiUrl(`management/v1/case-definition/${caseDefinitionKey}`)
    );
  }

  public setGlobalActiveCaseVersion(
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string
  ): Observable<any[]> {
    return this.httpClient.post<any[]>(
      this.getApiUrl(
        `management/v1/case-definition/${caseDefinitionKey}/version/${caseDefinitionVersionTag}/active`
      ),
      {}
    );
  }

  public getAllCaseVersions(params: any): Observable<Page<CaseVersionListItem>> {
    return this.httpClient.get<Page<CaseVersionListItem>>(
      this.getApiUrl(`management/v1/case-definition`),
      {params}
    );
  }

  public finalizeDraftCaseVersion(
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string
  ): Observable<any[]> {
    return this.httpClient.post<any[]>(
      this.getApiUrl(
        `management/v1/case-definition/${caseDefinitionKey}/version/${caseDefinitionVersionTag}/finalize`
      ),
      {}
    );
  }

  public deleteDraftCaseVersion(
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string
  ): Observable<null> {
    return this.httpClient.delete<null>(
      this.getApiUrl(
        `management/v1/case-definition/${caseDefinitionKey}/version/${caseDefinitionVersionTag}`
      )
    );
  }

  public getCaseDefinition(
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string
  ): Observable<CaseDefinition> {
    return this.httpClient.get<CaseDefinition>(
      this.getApiUrl(
        `management/v1/case-definition/${caseDefinitionKey}/version/${caseDefinitionVersionTag}`
      ),
      {
        headers: new HttpHeaders().set(InterceptorSkip, '403'),
      }
    );
  }

  public importDocumentDefinitionZip(file: FormData): Observable<HttpResponse<Blob>> {
    return this.httpClient.post<HttpResponse<Blob>>(
      this.getApiUrl(`management/v1/case/import`),
      file
    );
  }

  public exportDocumentDefinition(
    caseDefinitionKey: string,
    caseDefinitionVersionTag = '0'
  ): Observable<HttpResponse<Blob>> {
    return this.httpClient.get<Blob>(
      this.getApiUrl(
        `management/v1/case/${caseDefinitionKey}/version/${caseDefinitionVersionTag}/export`
      ),
      {observe: 'response', responseType: 'blob' as 'json', headers: InterceptorSkipHeader}
    );
  }
}
