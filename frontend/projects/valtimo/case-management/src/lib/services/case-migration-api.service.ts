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
import {BlueprintMigrationApiService} from '@valtimo/building-block-management';
import {CaseManagementParams, ConfigService} from '@valtimo/shared';
import {Observable} from 'rxjs';
import {DryRunStatus, MigrationExecutionStatus, MigrationPlanManagement} from '../models';

/** The migration plans of one case definition version. What is added over [BlueprintMigrationApiService] is what only a case plan has — a run of its own. */
@Injectable({providedIn: 'root'})
export class CaseMigrationApiService extends BlueprintMigrationApiService<
  CaseManagementParams,
  MigrationPlanManagement
> {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly httpClient: HttpClient
  ) {
    super(httpClient, configService);
  }

  protected getMigrationUrl(params: CaseManagementParams): string {
    return this.getApiUrl(
      `management/v1/case-definition/${params.caseDefinitionKey}/version/${params.caseDefinitionVersionTag}/migration`
    );
  }

  public startMigration(
    params: CaseManagementParams,
    migrationKey: string
  ): Observable<MigrationExecutionStatus> {
    return this.httpClient.post<MigrationExecutionStatus>(
      `${this.getMigrationUrl(params)}/${migrationKey}/start`,
      {}
    );
  }

  /** Start a dry run: simulate the plan for all matching cases without migrating any of them. */
  public startDryRun(params: CaseManagementParams, migrationKey: string): Observable<DryRunStatus> {
    return this.httpClient.post<DryRunStatus>(
      `${this.getMigrationUrl(params)}/${migrationKey}/dry-run`,
      {}
    );
  }
}
