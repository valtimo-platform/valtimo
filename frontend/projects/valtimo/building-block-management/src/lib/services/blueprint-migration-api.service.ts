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

import {BaseApiService} from '@valtimo/shared';
import {Observable} from 'rxjs';
import {
  BuildingBlockEntrySuggestion,
  BuildingBlockMode,
  MigrationEditorApi,
  MigrationPlanSource,
} from '../models';

/**
 * The migration endpoints every blueprint type serves, over whatever identifies one of its versions.
 *
 * A case definition version and a building block definition version are addressed differently
 * (`management/v1/case-definition/{key}/version/{tag}/migration` against
 * `management/v1/building-block/{key}/version/{tag}/migration`) and named by differently-shaped
 * params, but from there on the two APIs are the same API: the plan list, the plan JSON, the save, the
 * suggestion and the two activity-mapping helpers are identical in path, payload and meaning. Only the
 * base URL is a subclass's business, which is why [getMigrationUrl] is the single abstract member.
 *
 * `P` is the subclass's params type — `CaseManagementParams` or `BuildingBlockMigrationParams` — and
 * `M` its plan-summary row, which differs because a case plan reports a run it owns (triggers, a
 * progress count, a dry run) where a building block plan reports only how many instances it has been
 * applied to. Running a plan is deliberately *not* here for the same reason: a case plan is started,
 * and a building block plan is only ever applied by the case migration that moves its building block,
 * so `start` and `dry-run` belong to the case service alone.
 */
export abstract class BlueprintMigrationApiService<P, M> extends BaseApiService {
  protected abstract getMigrationUrl(params: P): string;

  public getPlans(params: P): Observable<M[]> {
    return this.httpClient.get<M[]>(this.getMigrationUrl(params));
  }

  public getPlanJson(params: P, migrationKey: string): Observable<Record<string, unknown>> {
    return this.httpClient.get<Record<string, unknown>>(
      `${this.getMigrationUrl(params)}/${migrationKey}`
    );
  }

  public savePlan(params: P, plan: Record<string, unknown>): Observable<M[]> {
    return this.httpClient.post<M[]>(this.getMigrationUrl(params), plan);
  }

  public deletePlan(params: P, migrationKey: string): Observable<void> {
    return this.httpClient.delete<void>(`${this.getMigrationUrl(params)}/${migrationKey}`);
  }

  /**
   * A best-effort, pre-filled plan for a new plan on this blueprint version.
   *
   * `source` names the version the plan should migrate instances from; omit it and the backend falls
   * back to this version's predecessor, which is what a new plan usually wants. Pass it to re-suggest
   * the components after the author picks a different source — including one under a different key.
   */
  public getPlanSuggestion(
    params: P,
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
    params: P,
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
    params: P,
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
   * A best-effort `dataMigration` + `processMigration` suggestion for one building-block entry, with
   * the `owner` it was computed against — see [MigrationEditorApi.suggestBuildingBlockEntry].
   */
  public suggestBuildingBlockEntry(
    params: P,
    buildingBlockKey: string,
    buildingBlockVersionTag: string,
    mode: BuildingBlockMode,
    source?: MigrationPlanSource | null
  ): Observable<BuildingBlockEntrySuggestion> {
    return this.httpClient.get<BuildingBlockEntrySuggestion>(
      `${this.getMigrationUrl(params)}/suggestion/building-block`,
      {
        params: {
          buildingBlockKey,
          buildingBlockVersionTag,
          mode,
          ...(source?.key ? {sourceKey: source.key} : {}),
          ...(source?.versionTag ? {sourceVersionTag: source.versionTag} : {}),
        },
      }
    );
  }

  /**
   * This service with [params] bound, as the shared plan-editor components consume it. Binding here
   * rather than passing the params down is what lets one set of components serve both blueprint types
   * without knowing how either is identified.
   */
  public forParams(params: P): MigrationEditorApi {
    return {
      suggestActivityMapping: (sourceId, targetId) =>
        this.suggestActivityMapping(params, sourceId, targetId),
      validateActivityMapping: (sourceId, targetId, mapping) =>
        this.validateActivityMapping(params, sourceId, targetId, mapping),
      suggestBuildingBlockEntry: (key, versionTag, mode, source) =>
        this.suggestBuildingBlockEntry(params, key, versionTag, mode, source),
    };
  }
}
