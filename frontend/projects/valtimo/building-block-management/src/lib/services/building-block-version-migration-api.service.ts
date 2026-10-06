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
  BuildingBlockVersionMigrationExecuteRequestDto,
  BuildingBlockVersionMigrationPreviewDto,
  BuildingBlockVersionMigrationPreviewRequestDto,
  BuildingBlockVersionMigrationResultDto,
  ConfigService,
} from '@valtimo/shared';
import {Observable} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class BuildingBlockVersionMigrationApiService extends BaseApiService {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly httpClient: HttpClient
  ) {
    super(httpClient, configService);
  }

  public getInUseVersions(key?: string): Observable<BuildingBlockInUseVersionDto[]> {
    return this.httpClient.get<BuildingBlockInUseVersionDto[]>(
      this.getApiUrl('management/v1/building-block/version-migration/in-use'),
      {params: key ? {key} : {}}
    );
  }

  public preview(
    request: BuildingBlockVersionMigrationPreviewRequestDto
  ): Observable<BuildingBlockVersionMigrationPreviewDto> {
    return this.httpClient.post<BuildingBlockVersionMigrationPreviewDto>(
      this.getApiUrl('management/v1/building-block/version-migration/preview'),
      request
    );
  }

  public execute(
    request: BuildingBlockVersionMigrationExecuteRequestDto
  ): Observable<BuildingBlockVersionMigrationResultDto> {
    return this.httpClient.post<BuildingBlockVersionMigrationResultDto>(
      this.getApiUrl('management/v1/building-block/version-migration/execute'),
      request
    );
  }
}
