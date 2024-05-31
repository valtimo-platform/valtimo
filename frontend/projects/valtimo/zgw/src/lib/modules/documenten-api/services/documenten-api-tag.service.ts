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
import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {BaseApiService, ConfigService, Page} from '@valtimo/config';
import {Observable} from 'rxjs';
import {DocumentenApiTag} from '../models/documenten-api-tag.model';

@Injectable({
  providedIn: 'root',
})
export class DocumentenApiTagService extends BaseApiService {
  constructor(
    private http: HttpClient,
    configService: ConfigService
  ) {
    super(http, configService);
  }

  public getTags(caseDefinitionName: string): Observable<DocumentenApiTag[]> {
    return this.http.get<DocumentenApiTag[]>(
      this.getApiUrl(`/v1/case-definition/${caseDefinitionName}/zgw-document/trefwoord`)
    );
  }

  public getTagsForAdmin(
    caseDefinitionName: string,
    params?: any
  ): Observable<Page<DocumentenApiTag>> {
    return this.http.get<Page<DocumentenApiTag>>(
      this.getApiUrl(`/management/v1/case-definition/${caseDefinitionName}/zgw-document/trefwoord`),
      {params}
    );
  }

  public createTag(caseDefinitionName: string, tagKey: string): Observable<void> {
    return this.http.post<void>(
      this.getApiUrl(
        `/management/v1/case-definition/${caseDefinitionName}/zgw-document/trefwoord/${tagKey}`
      ),
      {} //empty body because all data exists in path
    );
  }

  public deleteTag(caseDefinitionName: string, tagKey: string): Observable<void> {
    return this.http.delete<void>(
      this.getApiUrl(
        `/management/v1/case-definition/${caseDefinitionName}/zgw-document/trefwoord/${tagKey}`
      )
    );
  }

  public deleteTags(caseDefinitionName: string, tagKeys: string[]): Observable<void> {
    return this.http.delete<void>(
      this.getApiUrl(`/management/v1/case-definition/${caseDefinitionName}/zgw-document/trefwoord`),
      {body: tagKeys}
    );
  }
}
