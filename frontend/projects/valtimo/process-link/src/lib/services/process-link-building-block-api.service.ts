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

import {HttpClient, HttpErrorResponse, HttpHeaders} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {
  BaseApiService,
  BuildingBlockDefinitionDto,
  BuildingBlockVersionDto,
  ConfigService,
  InterceptorSkip,
  Page,
} from '@valtimo/shared';
import {BuildingBlockField, PluginsWithDependencies} from '../models';
import {catchError, Observable, of} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ProcessLinkBuildingBlockApiService extends BaseApiService {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly httpClient: HttpClient
  ) {
    super(httpClient, configService);
  }

  /**
   * Returns every version in one response. `all=true` makes the backend bypass paging, so the
   * page and size arguments have no effect here.
   */
  public getAllVersionsForBuildingBlock(key: string): Observable<Page<BuildingBlockVersionDto>> {
    return this.getVersionsForBuildingBlock(key, 0, 5, true);
  }

  public getVersionsForBuildingBlock(
    key: string,
    page: number = 0,
    size: number = 5,
    all: boolean = false
  ): Observable<Page<BuildingBlockVersionDto>> {
    return this.httpClient.get<Page<BuildingBlockVersionDto>>(
      this.getApiUrl(`management/v1/building-block/${key}/version`),
      {
        params: {page, size, all},
      }
    );
  }

  public getPluginDefinitionsForBuildingBlock(
    key: string,
    versionTag: string
  ): Observable<PluginsWithDependencies> {
    return this.httpClient.get<PluginsWithDependencies>(
      this.getApiUrl(`management/v1/building-block/${key}/version/${versionTag}/plugin`)
    );
  }

  public getFieldsForBuildingBlock(
    key: string,
    versionTag: string
  ): Observable<Array<BuildingBlockField>> {
    return this.httpClient.get<Array<BuildingBlockField>>(
      this.getApiUrl(`management/v1/building-block/${key}/version/${versionTag}/fields`)
    );
  }

  public getBuildingBlockDefinitions(options?: {
    includeArtwork: boolean;
  }): Observable<BuildingBlockDefinitionDto[]> {
    return this.httpClient
      .get<BuildingBlockDefinitionDto[]>(this.getApiUrl('management/v1/building-block'), {
        params: options,
        headers: new HttpHeaders().set(InterceptorSkip, '404'),
      })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 404) return of([]);
          throw error;
        })
      );
  }

  public getMainProcessDefinitionKeyForBuildingBlock(
    key: string,
    versionTag: string
  ): Observable<string> {
    return this.httpClient.get<string>(
      this.getApiUrl(
        `management/v1/building-block/${key}/version/${versionTag}/process-definition/main/key`
      ),
      {
        responseType: 'text' as 'json',
      }
    );
  }

  public isBuildingBlockProcess(processDefinitionId: string): Observable<boolean> {
    return this.httpClient
      .get<boolean>(
        this.getApiUrl(
          `management/v1/building-block/process-definition/${processDefinitionId}/is-building-block`
        )
      )
      .pipe(catchError(() => of(false)));
  }

  public getBuildingBlockDefinition(
    key: string,
    versionTag: string
  ): Observable<BuildingBlockDefinitionDto | null> {
    return this.httpClient
      .get<BuildingBlockDefinitionDto>(
        this.getApiUrl(`management/v1/building-block/${key}/version/${versionTag}`),
        {
          headers: new HttpHeaders().set(InterceptorSkip, '404'),
        }
      )
      .pipe(catchError(() => of(null)));
  }

  public getCaseDefinition(
    key: string,
    versionTag: string
  ): Observable<{name: string} | null> {
    return this.httpClient
      .get<{name: string}>(
        this.getApiUrl(`management/v1/case-definition/${key}/version/${versionTag}`),
        {
          headers: new HttpHeaders().set(InterceptorSkip, '404'),
        }
      )
      .pipe(catchError(() => of(null)));
  }
}
