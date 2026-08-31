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

import {Observable} from 'rxjs';

/*
 * The plan shape a migration plan editor edits, and the contracts the shared editor components in
 * `components/migration-plan-editor` are driven by.
 *
 * These are deliberately blueprint-agnostic: a case plan and a building block plan describe the same
 * four components (`dataMigration`, `processMigration`, `addBuildingBlock`, `removeBuildingBlock`)
 * over the same JSON, and only the *owner* differs. `@valtimo/case-management` imports them from here
 * and adds the two things a case plan has and a building block plan is refused at deploy time —
 * triggers and conditions.
 */

type BuildingBlockMigrationStatus =
  | 'NOT_STARTED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_ERRORS';

interface BuildingBlockMigrationParams {
  buildingBlockDefinitionKey: string;
  buildingBlockDefinitionVersionTag: string;
}

interface MigrationExecutionError {
  caseId: string;
  message: string | null;
}

/**
 * How far a plan has got. A building block plan has no run of its own — it is applied to an instance
 * when a case migration moves that instance's building block onto this version — so the only
 * meaningful figure is how many instances it has been applied to so far. There is no "still to
 * migrate": that depends on which cases migrate in future. Failures are reported on the case that
 * failed, because a building block that cannot migrate rolls its whole case back.
 */
interface MigrationExecutionStatus {
  status: BuildingBlockMigrationStatus;
  /** Building block instances this plan has been applied to. */
  casesMigrated: number;
}

interface MigrationPlanManagement {
  migrationKey: string;
  title: string | null;
  source: string;
  target: string;
  components: string[];
  status: MigrationExecutionStatus;
}

type DataMigrationTargetType = 'string' | 'integer' | 'long' | 'number' | 'double' | 'boolean';

/** A single value-resolver patch of the `dataMigration` block of a migration plan. */
interface DataMigrationPatch {
  /** Value-resolver path to copy from (mutually exclusive with `value`). */
  source?: string | null;
  /** Literal value to set on the target (mutually exclusive with `source`). */
  value?: unknown;
  /** Value-resolver path to write to. */
  target: string;
  /** Optional type coercion of the written value. */
  targetType?: DataMigrationTargetType | null;
}

/**
 * Which document schema a value-path selector resolves against: a case definition version or a
 * building block definition version. A `dataMigration` patch's source and target can point at
 * different documents (e.g. add building block: source = the owner, target = the building block).
 */
interface ValuePathContext {
  caseDefinitionKey?: string | null;
  caseDefinitionVersionTag?: string | null;
  buildingBlockKey?: string | null;
  buildingBlockVersionTag?: string | null;
}

/**
 * A single `setProcessVariables` patch: writes to the process variable at `target` (a value-resolver
 * path such as `pv:name` or a nested `pv:/config/enabled`), either copying from `source` or setting
 * the literal `value`. Resolved per migrating instance. Mirrors the backend `ProcessVariablePatch`.
 */
interface ProcessVariablePatch {
  /** Value-resolver path to copy from, e.g. `pv:/foo` or `doc:/emailadres` (mutually exclusive with `value`). */
  source?: string | null;
  /** Literal value to set on the target (mutually exclusive with `source`). */
  value?: unknown;
  /** Value-resolver path of the process variable to write to, e.g. `pv:name`. */
  target: string;
  /** Optional type coercion of the written value. */
  targetType?: DataMigrationTargetType | null;
}

/** A single instruction of the `processMigration` block, translated 1:1 into an Operaton MigrationPlan. */
interface ProcessMigrationInstruction {
  sourceProcessDefinitionKey: string;
  /**
   * Null only while authoring. The suggester leaves it blank for a source process it cannot account
   * for, so the row shows up as work; the backend refuses to store one, and Save stays disabled until
   * the author names a target or deletes the row.
   */
  targetProcessDefinitionKey: string | null;
  /** Source activity id -> target activity id. */
  mapActivities: {[sourceActivityId: string]: string};
  /** GZAC-layer value-resolver patches applied to the migrated process instance. */
  setProcessVariables: ProcessVariablePatch[];
  skipCustomListeners: boolean;
  skipIoMappings: boolean;
}

/**
 * The blueprint an `addBuildingBlock` / `removeBuildingBlock` entry exchanges data and processes with:
 * the instance being migrated for a block it links itself, and the **parent building block** for a
 * nested one — which is what the executors read from the running tree, and therefore which document a
 * nested entry's patches address.
 */
interface BuildingBlockEntryOwner {
  type: 'CASE' | 'BUILDING_BLOCK';
  key: string;
  versionTag: string;
}

/** One building-block entry as suggested, with the owner the suggestion was computed against. */
interface BuildingBlockEntrySuggestion {
  dataMigration: DataMigrationPatch[];
  processMigration: ProcessMigrationInstruction[];
  owner?: BuildingBlockEntryOwner;
}

/**
 * One `addBuildingBlock` entry: a building block to create on the instance being migrated (its owner
 * — a case, or a parent building block). The new building block document is created empty and filled
 * by `dataMigration` (each patch's `source` reads the owner document, its `target` writes into the new
 * building block document); `processMigration` hijacks the owner's running process(es) into the
 * building block. Mirrors the backend `AddBuildingBlockInstruction`.
 */
interface AddBuildingBlockInstruction {
  buildingBlockKey: string;
  buildingBlockVersionTag: string;
  dataMigration?: DataMigrationPatch[];
  processMigration?: ProcessMigrationInstruction[];
}

/**
 * One `removeBuildingBlock` entry: dissolve the building block(s) of `buildingBlockKey` anywhere below
 * the instance being migrated, at any depth, deepest first. `processMigration` hands the building
 * block's process(es) back to its owner and `dataMigration` copies data back (each patch's `source`
 * reads the building block document, its `target` writes into the owner document) before the building
 * block document is deleted. Mirrors the backend `RemoveBuildingBlockInstruction`.
 *
 * `buildingBlockVersionTag` is required, as `AddBuildingBlockInstruction`'s is: the entry's
 * `dataMigration` reads paths out of that version's document schema and its `processMigration` names
 * that version's process definitions. A fleet holding two versions of one block therefore needs one
 * entry per version, and a version no entry names fails the case rather than being left behind.
 */
interface RemoveBuildingBlockInstruction {
  buildingBlockKey: string;
  buildingBlockVersionTag: string;
  dataMigration?: DataMigrationPatch[];
  processMigration?: ProcessMigrationInstruction[];
}

/** Either kind of building-block entry — the two carry the same four fields. */
type BuildingBlockInstruction = AddBuildingBlockInstruction | RemoveBuildingBlockInstruction;

/** Whether a building-block tab edits the `addBuildingBlock` or the `removeBuildingBlock` component. */
type BuildingBlockMode = 'add' | 'remove';

/**
 * The blueprint version a plan migrates instances FROM. Required on every plan: the target is implied
 * by the definition version the plan is deployed under, but the source never is. It may name any
 * earlier version, and a different `key` altogether — which is how one blueprint is replaced by
 * another, carrying its running instances across. Omitting `key` means "the same key as the target".
 */
interface MigrationPlanSource {
  key?: string;
  versionTag?: string;
}

/**
 * The editable migration plan, matching the auto-deploy `*-migration.json` shape. The TARGET is not
 * part of it — that is the definition version the plan is deployed under — but the `source` is, and is
 * required. A case plan carries `migrationTriggers` and `conditions` on top of this; a building block
 * plan declaring either is refused at deploy time, which is why they are not modelled here.
 */
interface MigrationPlan {
  title?: string;
  key?: string;
  source?: MigrationPlanSource;
  dataMigration?: DataMigrationPatch[];
  processMigration?: ProcessMigrationInstruction[];
  addBuildingBlock?: AddBuildingBlockInstruction[];
  removeBuildingBlock?: RemoveBuildingBlockInstruction[];
  [key: string]: unknown;
}

/**
 * The `data-test-id`s the shared editor components stamp onto the controls e2e drives them by.
 *
 * Passed in rather than imported, because the two hosts use distinct values (`caseMigration*` /
 * `buildingBlockMigration*`) and an e2e test names the literal string. Sharing the components must not
 * mean sharing the ids: a test that drives the case editor should not match on the building block one.
 */
interface MigrationEditorTestIds {
  addPatchButton: string;
  addInstructionButton: string;
  addBuildingBlockButton: string;
  removeBuildingBlockButton: string;
  sourceKeySelect: string;
  sourceVersionSelect: string;
}

/**
 * The migration API as the shared editor components need it, with the blueprint the plan belongs to
 * already bound.
 *
 * The two hosts address different endpoints (`.../case-definition/{key}/version/{tag}/migration` and
 * `.../building-block/{key}/version/{tag}/migration`) and identify a blueprint with differently-named
 * params, which is the only reason the components could not simply inject one service. Each host binds
 * its own params once — see `BlueprintMigrationApiService.forParams` — and hands the result down.
 */
interface MigrationEditorApi {
  /** A best-effort `sourceActivityId -> targetActivityId` mapping for a source/target process pair. */
  suggestActivityMapping(
    sourceProcessDefinitionId: string,
    targetProcessDefinitionId: string
  ): Observable<Record<string, string>>;

  /**
   * The incompatible `sourceActivityId -> failure messages` pairs in a proposed activity mapping, as
   * judged by the engine (empty when every pair is valid).
   */
  validateActivityMapping(
    sourceProcessDefinitionId: string,
    targetProcessDefinitionId: string,
    activityMapping: Record<string, string>
  ): Observable<Record<string, string[]>>;

  /**
   * A best-effort `dataMigration` + `processMigration` suggestion for one building-block entry, with
   * the `owner` it was computed against.
   *
   * The owner is not always the blueprint the plan targets: a nested building block exchanges data and
   * processes with the block that declares it, which is what the executors read from the running tree.
   * The plan's source is passed because a `remove` entry names a block the *source* version still
   * models, and it is that version's tree the owner has to be resolved in.
   */
  suggestBuildingBlockEntry(
    buildingBlockKey: string,
    buildingBlockVersionTag: string,
    mode: BuildingBlockMode,
    source?: MigrationPlanSource | null
  ): Observable<BuildingBlockEntrySuggestion>;
}

export {
  AddBuildingBlockInstruction,
  BuildingBlockEntryOwner,
  BuildingBlockEntrySuggestion,
  BuildingBlockInstruction,
  BuildingBlockMigrationParams,
  BuildingBlockMigrationStatus,
  BuildingBlockMode,
  DataMigrationPatch,
  DataMigrationTargetType,
  MigrationEditorApi,
  MigrationEditorTestIds,
  MigrationExecutionError,
  MigrationExecutionStatus,
  MigrationPlan,
  MigrationPlanManagement,
  MigrationPlanSource,
  ProcessMigrationInstruction,
  ProcessVariablePatch,
  RemoveBuildingBlockInstruction,
  ValuePathContext,
};
