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

import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {
  BaseApiService,
  BuildingBlockReferenceUpdateExecuteRequestDto,
  BuildingBlockReferenceUpdatePreviewDto,
  BuildingBlockReferenceUpdatePreviewRequestDto,
  BuildingBlockReferenceDto,
  BuildingBlockReferenceUpdateResultDto,
  ConfigService,
} from '@valtimo/shared';
import {Observable} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class BuildingBlockReferenceUpdateApiService extends BaseApiService {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly httpClient: HttpClient
  ) {
    super(httpClient, configService);
  }

  public getReferences(key: string, versionTag: string): Observable<BuildingBlockReferenceDto[]> {
    return this.httpClient.get<BuildingBlockReferenceDto[]>(
      this.getApiUrl(
        `management/v1/building-block/reference-update/references/${key}/version/${versionTag}`
      )
    );
  }

  public preview(
    request: BuildingBlockReferenceUpdatePreviewRequestDto
  ): Observable<BuildingBlockReferenceUpdatePreviewDto> {
    return this.httpClient.post<BuildingBlockReferenceUpdatePreviewDto>(
      this.getApiUrl('management/v1/building-block/reference-update/preview'),
      request
    );
  }

  public execute(
    request: BuildingBlockReferenceUpdateExecuteRequestDto
  ): Observable<BuildingBlockReferenceUpdateResultDto> {
    return this.httpClient.post<BuildingBlockReferenceUpdateResultDto>(
      this.getApiUrl('management/v1/building-block/reference-update/execute'),
      request
    );
  }
}
