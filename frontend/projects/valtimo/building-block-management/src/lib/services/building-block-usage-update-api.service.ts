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
  BuildingBlockInUseVersionDto,
  BuildingBlockUsageUpdateExecuteRequestDto,
  BuildingBlockUsageUpdatePreviewDto,
  BuildingBlockUsageUpdatePreviewRequestDto,
  BuildingBlockUsageUpdateResultDto,
  ConfigService,
} from '@valtimo/shared';
import {Observable} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class BuildingBlockUsageUpdateApiService extends BaseApiService {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly httpClient: HttpClient
  ) {
    super(httpClient, configService);
  }

  public getInUseVersions(key?: string): Observable<BuildingBlockInUseVersionDto[]> {
    return this.httpClient.get<BuildingBlockInUseVersionDto[]>(
      this.getApiUrl('management/v1/building-block/usage-update/in-use'),
      {params: key ? {key} : {}}
    );
  }

  public preview(
    request: BuildingBlockUsageUpdatePreviewRequestDto
  ): Observable<BuildingBlockUsageUpdatePreviewDto> {
    return this.httpClient.post<BuildingBlockUsageUpdatePreviewDto>(
      this.getApiUrl('management/v1/building-block/usage-update/preview'),
      request
    );
  }

  public execute(
    request: BuildingBlockUsageUpdateExecuteRequestDto
  ): Observable<BuildingBlockUsageUpdateResultDto> {
    return this.httpClient.post<BuildingBlockUsageUpdateResultDto>(
      this.getApiUrl('management/v1/building-block/usage-update/execute'),
      request
    );
  }
}
