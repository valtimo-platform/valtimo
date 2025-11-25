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
import {BuildingBlockField} from '../models';
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

  public getVersionsForBuildingBlock(
    key: string,
    page: number = 0,
    size: number = 5,
    all: boolean = false
  ): Observable<Page<BuildingBlockVersionDto>> {
    const allParam: string = all ? 'all=true' : '';
    return this.httpClient.get<Page<BuildingBlockVersionDto>>(
      this.getApiUrl(
        `management/v1/building-block/${key}/version?page=${page}&size=${size}${allParam}`
      )
    );
  }

  public getPluginDefinitionsForBuildingBlock(
    key: string,
    versionTag: string
  ): Observable<string[]> {
    return this.httpClient.get<string[]>(
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
}
