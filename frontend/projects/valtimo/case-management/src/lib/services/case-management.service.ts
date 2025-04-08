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
import {HttpClient, HttpResponse} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {BaseApiService, ConfigService} from '@valtimo/config';
import {Page} from '@valtimo/document';
import {InterceptorSkipHeader} from '@valtimo/security';
import {Observable} from 'rxjs';
import {CaseListItem} from '../models';

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
      this.getApiUrl(`management/v1/case-definition/${caseDefinitionKey}/version`)
    );
  }

  public importDocumentDefinitionZip(file: FormData): Observable<HttpResponse<Blob>> {
    return this.httpClient.post<HttpResponse<Blob>>(
      this.getApiUrl(`management/v1/case/import`),
      file
    );
  }

  public exportDocumentDefinition(
    documentDefinitionName: string,
    version = 1
  ): Observable<HttpResponse<Blob>> {
    return this.httpClient.get<Blob>(
      this.getApiUrl(`management/v1/case/${documentDefinitionName}/${version}/export`),
      {observe: 'response', responseType: 'blob' as 'json', headers: InterceptorSkipHeader}
    );
  }
}
