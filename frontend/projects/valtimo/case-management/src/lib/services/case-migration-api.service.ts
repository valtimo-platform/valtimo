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
import {
  DataMigrationPatch,
  DryRunStatus,
  MigrationExecutionStatus,
  MigrationPlanManagement,
  MigrationPlanSource,
  ProcessMigrationInstruction,
} from '../models';

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

  /** Start a dry run: simulate the plan for all matching cases without migrating any of them. */
  public startDryRun(params: CaseManagementParams, migrationKey: string): Observable<DryRunStatus> {
    return this.httpClient.post<DryRunStatus>(
      `${this.getMigrationUrl(params)}/${migrationKey}/dry-run`,
      {}
    );
  }

  public getDryRunStatus(
    params: CaseManagementParams,
    migrationKey: string
  ): Observable<DryRunStatus> {
    return this.httpClient.get<DryRunStatus>(
      `${this.getMigrationUrl(params)}/${migrationKey}/dry-run/status`
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

  /** A best-effort, pre-filled plan (dataMigration, processMigration) for a new plan. */
  /**
   * A best-effort, pre-filled plan for a new plan on this case definition version.
   *
   * `source` names the version the plan should migrate instances from; omit it and the backend falls
   * back to this version's predecessor, which is what a new plan usually wants. Pass it to re-suggest
   * the components after the author picks a different source.
   */
  public getPlanSuggestion(
    params: CaseManagementParams,
    source?: MigrationPlanSource
  ): Observable<Record<string, unknown>> {
    const query: Record<string, string> = {};
    if (source?.key) query['sourceKey'] = source.key;
    if (source?.versionTag) query['sourceVersionTag'] = source.versionTag;
    return this.httpClient.get<Record<string, unknown>>(
      `${this.getMigrationUrl(params)}/suggestion`,
      {params: query}
    );
  }

  /** A best-effort `sourceActivityId -> targetActivityId` mapping for a source/target process pair. */
  public suggestActivityMapping(
    params: CaseManagementParams,
    sourceProcessDefinitionId: string,
    targetProcessDefinitionId: string
  ): Observable<Record<string, string>> {
    return this.httpClient.get<Record<string, string>>(
      `${this.getMigrationUrl(params)}/suggestion/activity-mapping`,
      {params: {sourceProcessDefinitionId, targetProcessDefinitionId}}
    );
  }

  /**
   * The incompatible `sourceActivityId -> failure messages` pairs in a proposed activity mapping for
   * a source/target process pair, as judged by the engine (empty when every pair is valid).
   */
  public validateActivityMapping(
    params: CaseManagementParams,
    sourceProcessDefinitionId: string,
    targetProcessDefinitionId: string,
    activityMapping: Record<string, string>
  ): Observable<Record<string, string[]>> {
    return this.httpClient.post<Record<string, string[]>>(
      `${this.getMigrationUrl(params)}/suggestion/activity-mapping/validate`,
      activityMapping,
      {params: {sourceProcessDefinitionId, targetProcessDefinitionId}}
    );
  }

  /** A best-effort `dataMigration` + `processMigration` suggestion for one building-block entry. */
  public suggestBuildingBlockEntry(
    params: CaseManagementParams,
    buildingBlockKey: string,
    buildingBlockVersionTag: string,
    mode: 'add' | 'remove'
  ): Observable<{dataMigration: DataMigrationPatch[]; processMigration: ProcessMigrationInstruction[]}> {
    return this.httpClient.get<{
      dataMigration: DataMigrationPatch[];
      processMigration: ProcessMigrationInstruction[];
    }>(`${this.getMigrationUrl(params)}/suggestion/building-block`, {
      params: {buildingBlockKey, buildingBlockVersionTag, mode},
    });
  }

  public deletePlan(params: CaseManagementParams, migrationKey: string): Observable<void> {
    return this.httpClient.delete<void>(`${this.getMigrationUrl(params)}/${migrationKey}`);
  }
}
