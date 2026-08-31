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

/* The blueprint-agnostic plan shape the shared migration plan editor components are driven by; `@valtimo/case-management` adds triggers and conditions on top. */

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

/** How far a plan has got. A building block plan has no run of its own, so the only meaningful figure is how many instances it has been applied to. */
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

/** Which document schema a value-path selector resolves against; a patch's source and target can point at different documents. */
interface ValuePathContext {
  caseDefinitionKey?: string | null;
  caseDefinitionVersionTag?: string | null;
  buildingBlockKey?: string | null;
  buildingBlockVersionTag?: string | null;
}

/** A single `setProcessVariables` patch, resolved per migrating instance. Mirrors the backend `ProcessVariablePatch`. */
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
  /** Null only while authoring — the suggester leaves it blank for a source it cannot account for, and the backend refuses to store one. */
  targetProcessDefinitionKey: string | null;
  /** Source activity id -> target activity id. */
  mapActivities: {[sourceActivityId: string]: string};
  /** GZAC-layer value-resolver patches applied to the migrated process instance. */
  setProcessVariables: ProcessVariablePatch[];
  skipCustomListeners: boolean;
  skipIoMappings: boolean;
}

/** The blueprint an add/removeBuildingBlock entry exchanges data and processes with — the parent building block for a nested one. */
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

/** One `addBuildingBlock` entry: `dataMigration` fills the new block's document from the owner, `processMigration` hijacks the owner's running processes. */
interface AddBuildingBlockInstruction {
  buildingBlockKey: string;
  buildingBlockVersionTag: string;
  dataMigration?: DataMigrationPatch[];
  processMigration?: ProcessMigrationInstruction[];
}

/** One `removeBuildingBlock` entry: hand the processes back and copy data back before the block document is deleted. The version tag is required, so a fleet on two versions needs two entries. */
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

/** The blueprint version a plan migrates instances FROM. Required, and may name a different key — which is how one blueprint replaces another. */
interface MigrationPlanSource {
  key?: string;
  versionTag?: string;
}

/** The editable plan, matching the auto-deploy `*-migration.json` shape. The target is the version the plan is deployed under; triggers and conditions are case-only. */
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

/** The `data-test-id`s the shared components stamp onto their controls. Passed in, because the two hosts use distinct literal values that e2e tests match on. */
interface MigrationEditorTestIds {
  addPatchButton: string;
  addInstructionButton: string;
  addBuildingBlockButton: string;
  removeBuildingBlockButton: string;
  sourceKeySelect: string;
  sourceVersionSelect: string;
}

/** The migration API with the plan's blueprint already bound — the two hosts address different endpoints and identify a blueprint with differently-named params. */
interface MigrationEditorApi {
  /** A best-effort `sourceActivityId -> targetActivityId` mapping for a source/target process pair. */
  suggestActivityMapping(
    sourceProcessDefinitionId: string,
    targetProcessDefinitionId: string
  ): Observable<Record<string, string>>;

  /** The incompatible `sourceActivityId -> failure messages` pairs in a proposed mapping, as judged by the engine. */
  validateActivityMapping(
    sourceProcessDefinitionId: string,
    targetProcessDefinitionId: string,
    activityMapping: Record<string, string>
  ): Observable<Record<string, string[]>>;

  /** A best-effort suggestion for one building-block entry, with the `owner` it was computed against. The plan source is passed because a `remove` entry names a block the source version models. */
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
