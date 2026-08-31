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
import {ConfigService} from '@valtimo/shared';
import {BuildingBlockMigrationParams, MigrationPlanManagement} from '../models';
import {BlueprintMigrationApiService} from './blueprint-migration-api.service';

/** The migration plans of one building block definition version. No `start` and no dry run — a building block plan is applied and simulated by the case migration that moves its block. */
@Injectable({providedIn: 'root'})
export class BuildingBlockMigrationApiService extends BlueprintMigrationApiService<
  BuildingBlockMigrationParams,
  MigrationPlanManagement
> {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly httpClient: HttpClient
  ) {
    super(httpClient, configService);
  }

  protected getMigrationUrl(params: BuildingBlockMigrationParams): string {
    return this.getApiUrl(
      `management/v1/building-block/${params.buildingBlockDefinitionKey}/version/${params.buildingBlockDefinitionVersionTag}/migration`
    );
  }
}
