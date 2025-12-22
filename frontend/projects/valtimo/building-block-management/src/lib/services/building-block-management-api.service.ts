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

import {HttpClient, HttpErrorResponse, HttpHeaders, HttpResponse} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {
  BaseApiService,
  BuildingBlockDefinitionArtworkDto,
  BuildingBlockDefinitionDto,
  BuildingBlockProcessDefinitionDto,
  BuildingBlockVersionDto,
  ConfigService,
  CreateBuildingBlockDefinitionArtworkDto,
  CreateBuildingBlockDefinitionDto,
  InterceptorSkip,
  Page,
  UpdateBuildingBlockDefinitionDto,
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

  public updateBuildingBlockDefinition(
    key: string,
    versionTag: string,
    dto: UpdateBuildingBlockDefinitionDto
  ): Observable<BuildingBlockDefinitionDto> {
    return this.httpClient.put<BuildingBlockDefinitionDto>(
      this.getApiUrl(`management/v1/building-block/${key}/version/${versionTag}`),
      dto
    );
  }

  public getBuildingBlockDocumentDefinition(key: string, versionTag: string): Observable<object> {
    return this.httpClient.get<object>(
      this.getApiUrl(`management/v1/building-block/${key}/version/${versionTag}/document`)
    );
  }

  public updateBuildingBlockDocumentDefinition(
    key: string,
    versionTag: string,
    schema: any
  ): Observable<object> {
    return this.httpClient.put<object>(
      this.getApiUrl(`management/v1/building-block/${key}/version/${versionTag}/document`),
      schema
    );
  }

  public getBuildingBlockProcessDefinitions(
    key: string,
    versionTag: string
  ): Observable<BuildingBlockProcessDefinitionDto[]> {
    return this.httpClient.get<BuildingBlockProcessDefinitionDto[]>(
      this.getApiUrl(`management/v1/building-block/${key}/version/${versionTag}/process-definition`)
    );
  }

  public importBuildingBlockDefinition(file: FormData): Observable<HttpResponse<Blob>> {
    return this.httpClient.post<HttpResponse<Blob>>(
      this.getApiUrl(`management/v1/building-block/import`),
      file
    );
  }

  public getBuildingBlockArtwork(
    key: string,
    versionTag: string
  ): Observable<BuildingBlockDefinitionArtworkDto | null> {
    return this.httpClient
      .get<BuildingBlockDefinitionArtworkDto>(
        this.getApiUrl(`management/v1/building-block/${key}/version/${versionTag}/artwork`),
        {
          headers: new HttpHeaders().set(InterceptorSkip, '404'),
        }
      )
      .pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 404) return of(null);
          throw error;
        })
      );
  }

  public createBuildingBlockArtwork(
    key: string,
    versionTag: string,
    dto: CreateBuildingBlockDefinitionArtworkDto
  ): Observable<BuildingBlockDefinitionArtworkDto> {
    return this.httpClient.post<BuildingBlockDefinitionArtworkDto>(
      this.getApiUrl(`management/v1/building-block/${key}/version/${versionTag}/artwork`),
      dto
    );
  }

  public deleteBuildingBlockArtwork(key: string, versionTag: string): Observable<void> {
    return this.httpClient.delete<void>(
      this.getApiUrl(`management/v1/building-block/${key}/version/${versionTag}/artwork`)
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

  public getVersionsForBuildingBlock(
    key: string,
    page: number = 0,
    size: number = 5,
    all: boolean = false
  ): Observable<Page<BuildingBlockVersionDto>> {
    return this.httpClient.get<Page<BuildingBlockVersionDto>>(
      this.getApiUrl(`management/v1/building-block/${key}/version`),
      {
        params: {
          page,
          size,
          all,
        } as any,
      }
    );
  }

  public finalizeBuildingBlockDefinition(
    key: string,
    versionTag: string
  ): Observable<BuildingBlockDefinitionDto> {
    return this.httpClient.post<BuildingBlockDefinitionDto>(
      this.getApiUrl(`management/v1/building-block/${key}/version/${versionTag}/finalize`),
      {}
    );
  }

  public createDraftBuildingBlockDefinition(
    key: string,
    basedOnVersionTag: string,
    versionTag: string
  ): Observable<BuildingBlockDefinitionDto> {
    return this.httpClient.post<BuildingBlockDefinitionDto>(
      this.getApiUrl(`management/v1/building-block/${key}/version/${basedOnVersionTag}/draft`),
      {versionTag}
    );
  }

  public setMainBuildingBlockProcessDefinition(
    key: string,
    versionTag: string,
    processDefinitionId: string
  ): Observable<void> {
    return this.httpClient.post<void>(
      this.getApiUrl(
        `management/v1/building-block/${key}/version/${versionTag}/process-definition/${processDefinitionId}/main`
      ),
      {}
    );
  }

  public deleteBuildingBlockProcessDefinition(
    key: string,
    versionTag: string,
    processDefinitionId: string
  ): Observable<void> {
    return this.httpClient.delete<void>(
      this.getApiUrl(
        `management/v1/building-block/${key}/version/${versionTag}/process-definition/${processDefinitionId}`
      )
    );
  }
}
