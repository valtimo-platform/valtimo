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
  ConfigService,
  CreateBuildingBlockDefinitionDto,
  InterceptorSkip,
} from '@valtimo/shared';
import {catchError, Observable, of} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class BuildingBlockManagementApiService extends BaseApiService {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly httpClient: HttpClient
  ) {
    super(httpClient, configService);
  }

  public getBuildingBlockDefinitions(): Observable<BuildingBlockDefinitionDto[]> {
    return this.httpClient
      .get<BuildingBlockDefinitionDto[]>(this.getApiUrl('management/v1/building-block'), {
        headers: new HttpHeaders().set(InterceptorSkip, '404'),
      })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 404) return of([]);
          throw error;
        })
      );
  }

  public createBuildingBlockDefinition(
    dto: CreateBuildingBlockDefinitionDto
  ): Observable<BuildingBlockDefinitionDto> {
    return this.httpClient.post<BuildingBlockDefinitionDto>(
      this.getApiUrl('management/v1/building-block'),
      dto
    );
  }

  public getBuildingBlockDefinition(
    key: string,
    versionTag: string
  ): Observable<BuildingBlockDefinitionDto> {
    return this.httpClient.get<BuildingBlockDefinitionDto>(
      this.getApiUrl(`management/v1/building-block/${key}/version/${versionTag}`)
    );
  }
}
