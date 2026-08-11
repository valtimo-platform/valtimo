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
import {BaseApiService, ConfigService} from '@valtimo/shared';
import {Observable} from 'rxjs';
import {
  BuildingBlockMigrationParams,
  DataMigrationPatch,
  MigrationExecutionStatus,
  MigrationPlanManagement,
  MigrationPlanSource,
  ProcessMigrationInstruction,
} from '../models';

@Injectable({providedIn: 'root'})
export class BuildingBlockMigrationApiService extends BaseApiService {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly httpClient: HttpClient
  ) {
    super(httpClient, configService);
  }

  private getMigrationUrl(params: BuildingBlockMigrationParams): string {
    return this.getApiUrl(
      `management/v1/building-block/${params.buildingBlockDefinitionKey}/version/${params.buildingBlockDefinitionVersionTag}/migration`
    );
  }

  public getPlans(params: BuildingBlockMigrationParams): Observable<MigrationPlanManagement[]> {
    return this.httpClient.get<MigrationPlanManagement[]>(this.getMigrationUrl(params));
  }

  /**
   * How far a plan has got. There is no `start` and no dry run: a building block plan is applied by
   * the case migration that moves a building block onto its version, and simulated by that case
   * migration's dry run.
   */
  public getStatus(
    params: BuildingBlockMigrationParams,
    migrationKey: string
  ): Observable<MigrationExecutionStatus> {
    return this.httpClient.get<MigrationExecutionStatus>(
      `${this.getMigrationUrl(params)}/${migrationKey}/status`
    );
  }

  public getPlanJson(
    params: BuildingBlockMigrationParams,
    migrationKey: string
  ): Observable<Record<string, unknown>> {
    return this.httpClient.get<Record<string, unknown>>(
      `${this.getMigrationUrl(params)}/${migrationKey}`
    );
  }

  public savePlan(
    params: BuildingBlockMigrationParams,
    plan: Record<string, unknown>
  ): Observable<MigrationPlanManagement[]> {
    return this.httpClient.post<MigrationPlanManagement[]>(this.getMigrationUrl(params), plan);
  }

  /**
   * A best-effort, pre-filled plan for a new plan on this building block definition version.
   *
   * `source` names the version the plan should migrate instances from; omit it and the backend falls
   * back to this version's predecessor. Pass it to re-suggest the components after the author picks a
   * different source — including one under a different building block key.
   */
  public getPlanSuggestion(
    params: BuildingBlockMigrationParams,
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

  public suggestActivityMapping(
    params: BuildingBlockMigrationParams,
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
    params: BuildingBlockMigrationParams,
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

  /**
   * A best-effort `dataMigration` + `processMigration` suggestion for one nested-building-block entry
   * — `add` reads from the owner building block, `remove` reads from the nested one.
   */
  public suggestBuildingBlockEntry(
    params: BuildingBlockMigrationParams,
    buildingBlockKey: string,
    buildingBlockVersionTag: string,
    mode: 'add' | 'remove'
  ): Observable<{
    dataMigration: DataMigrationPatch[];
    processMigration: ProcessMigrationInstruction[];
  }> {
    return this.httpClient.get<{
      dataMigration: DataMigrationPatch[];
      processMigration: ProcessMigrationInstruction[];
    }>(`${this.getMigrationUrl(params)}/suggestion/building-block`, {
      params: {buildingBlockKey, buildingBlockVersionTag, mode},
    });
  }

  public deletePlan(
    params: BuildingBlockMigrationParams,
    migrationKey: string
  ): Observable<void> {
    return this.httpClient.delete<void>(`${this.getMigrationUrl(params)}/${migrationKey}`);
  }
}
