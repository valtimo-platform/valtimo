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
import {BaseApiService, CaseManagementParams, ConfigService} from '@valtimo/shared';
import {Observable} from 'rxjs';
import {MigrationExecutionStatus, MigrationPlanManagement} from '../models';

@Injectable({providedIn: 'root'})
export class CaseMigrationApiService extends BaseApiService {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly httpClient: HttpClient
  ) {
    super(httpClient, configService);
  }

  private getMigrationUrl(params: CaseManagementParams): string {
    return this.getApiUrl(
      `management/v1/case-definition/${params.caseDefinitionKey}/version/${params.caseDefinitionVersionTag}/migration`
    );
  }

  public getPlans(params: CaseManagementParams): Observable<MigrationPlanManagement[]> {
    return this.httpClient.get<MigrationPlanManagement[]>(this.getMigrationUrl(params));
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

  public getStatus(
    params: CaseManagementParams,
    migrationKey: string
  ): Observable<MigrationExecutionStatus> {
    return this.httpClient.get<MigrationExecutionStatus>(
      `${this.getMigrationUrl(params)}/${migrationKey}/status`
    );
  }

  public getPlanJson(
    params: CaseManagementParams,
    migrationKey: string
  ): Observable<Record<string, unknown>> {
    return this.httpClient.get<Record<string, unknown>>(
      `${this.getMigrationUrl(params)}/${migrationKey}`
    );
  }

  public savePlan(
    params: CaseManagementParams,
    plan: Record<string, unknown>
  ): Observable<MigrationPlanManagement[]> {
    return this.httpClient.post<MigrationPlanManagement[]>(this.getMigrationUrl(params), plan);
  }

  public deletePlan(params: CaseManagementParams, migrationKey: string): Observable<void> {
    return this.httpClient.delete<void>(`${this.getMigrationUrl(params)}/${migrationKey}`);
  }
}
