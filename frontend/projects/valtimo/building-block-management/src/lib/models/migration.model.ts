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

interface DataMigrationPatch {
  source?: string | null;
  value?: unknown;
  target: string;
  targetType?: DataMigrationTargetType | null;
}

// The building block document the source (copy-from) and target (write-to) value-path selectors
// resolve against. Both point at the plan's own building block definition version.
interface ValuePathContext {
  buildingBlockKey?: string | null;
  buildingBlockVersionTag?: string | null;
}

interface ProcessVariablePatch {
  source?: string | null;
  value?: unknown;
  target: string;
  targetType?: DataMigrationTargetType | null;
}

interface ProcessMigrationInstruction {
  sourceProcessDefinitionKey: string;
  targetProcessDefinitionKey: string;
  mapActivities: {[sourceActivityId: string]: string};
  setProcessVariables: ProcessVariablePatch[];
  skipCustomListeners: boolean;
  skipIoMappings: boolean;
}

/**
 * The building block version a plan migrates instances FROM. Required on every plan: the target is
 * implied by the definition version the plan is deployed under, but the source never is. It may name
 * any earlier version, and a different `key` altogether — which is how one building block is replaced
 * by another, carrying its running instances across. Omitting `key` means "the same key as the target".
 */
interface MigrationPlanSource {
  key?: string;
  versionTag?: string;
}

/**
 * One `addBuildingBlock` entry: a building block to create *inside* the migrating building block,
 * filled from the owner by its own `dataMigration` and taking over one of the owner's processes by
 * its own `processMigration`.
 */
interface AddBuildingBlockInstruction {
  buildingBlockKey: string;
  buildingBlockVersionTag: string;
  dataMigration?: DataMigrationPatch[];
  processMigration?: ProcessMigrationInstruction[];
}

/**
 * One `removeBuildingBlock` entry: a nested building block to dissolve, anywhere below the migrating
 * instance and deepest first. `buildingBlockVersionTag` is required, as `AddBuildingBlockInstruction`'s
 * is: the entry's `dataMigration` reads paths out of that version's document schema and its
 * `processMigration` names that version's process definitions. A fleet holding two versions of one block
 * therefore needs one entry per version, and a version no entry names fails the case rather than being
 * left behind.
 */
interface RemoveBuildingBlockInstruction {
  buildingBlockKey: string;
  buildingBlockVersionTag: string;
  dataMigration?: DataMigrationPatch[];
  processMigration?: ProcessMigrationInstruction[];
}

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

export {
  BuildingBlockMigrationStatus,
  BuildingBlockMigrationParams,
  MigrationExecutionError,
  MigrationExecutionStatus,
  MigrationPlanManagement,
  MigrationPlanSource,
  DataMigrationTargetType,
  DataMigrationPatch,
  ValuePathContext,
  ProcessVariablePatch,
  ProcessMigrationInstruction,
  AddBuildingBlockInstruction,
  RemoveBuildingBlockInstruction,
  MigrationPlan,
};
