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

import {ValueConditionNode} from '@valtimo/components';

type CaseMigrationStatus = 'NOT_STARTED' | 'RUNNING' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS';

interface MigrationTriggers {
  triggeredByButton: boolean;
  scheduledAtDate: string | null;
  runAfter: string | null;
}

/**
 * A gating condition, or a group of them combined with AND (`allOf`) / OR (`anyOf`). Shared with the
 * condition tree editor, which owns the mapping to and from the form.
 */
type MigrationConditionNode = ValueConditionNode;

interface MigrationExecutionError {
  caseId: string;
  message: string | null;
}

interface MigrationExecutionStatus {
  status: CaseMigrationStatus;
  /** Cases still needing migration; drops to 0 once the run has migrated its whole matching slice. */
  casesToMigrate: number;
  /** Total cases the run is migrating (its matched slice) — the denominator of the progress display. */
  casesTotal: number;
  casesMigrated: number;
  casesWithErrors: number;
  errors: MigrationExecutionError[];
  startedOn: string | null;
  finishedOn: string | null;
}

/**
 * The result of a plan's latest dry run: a simulation that migrates nothing, reporting how many
 * matching cases would migrate, how many would fail, and — per failing case — the reason.
 */
interface DryRunStatus {
  status: CaseMigrationStatus;
  casesChecked: number;
  casesWouldMigrate: number;
  casesWouldFail: number;
  errors: MigrationExecutionError[];
  startedOn: string | null;
  finishedOn: string | null;
}

interface MigrationPlanManagement {
  migrationKey: string;
  title: string | null;
  source: string;
  target: string;
  triggers: MigrationTriggers;
  status: MigrationExecutionStatus;
  dryRun: DryRunStatus;
}

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

type DataMigrationTargetType = 'string' | 'integer' | 'long' | 'number' | 'double' | 'boolean';

/**
 * Which document schema a value-path selector resolves against: a case definition version or a
 * building block definition version. A `dataMigration` patch's source and target can point at
 * different documents (e.g. add building block: source = owner case, target = the building block).
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
  targetProcessDefinitionKey: string;
  /** Source activity id -> target activity id. */
  mapActivities: {[sourceActivityId: string]: string};
  /** GZAC-layer value-resolver patches applied to the migrated process instance. */
  setProcessVariables: ProcessVariablePatch[];
  skipCustomListeners: boolean;
  skipIoMappings: boolean;
}

/**
 * A single `addBuildingBlock` entry: a building block to create on the instance being migrated (its
 * owner — a case, or a parent building block). The new building block document is created empty and
 * filled by `dataMigration` (each patch's `source` reads the owner document, its `target` writes
 * into the new building block document); `processMigration` hijacks the owner's running process(es)
 * into the building block. Mirrors the backend `AddBuildingBlockInstruction`.
 */
interface AddBuildingBlockInstruction {
  buildingBlockKey: string;
  buildingBlockVersionTag: string;
  dataMigration: DataMigrationPatch[];
  processMigration: ProcessMigrationInstruction[];
}

/**
 * A single `removeBuildingBlock` entry: dissolve the building block(s) of `buildingBlockKey`
 * directly linked to the instance being migrated. `processMigration` hands the building block's
 * process(es) back to the owner and `dataMigration` copies data back (each patch's `source` reads
 * the building block document, its `target` writes into the owner document) before the building
 * block document is deleted. Mirrors the backend `RemoveBuildingBlockInstruction`.
 */
interface RemoveBuildingBlockInstruction {
  buildingBlockKey: string;
  dataMigration: DataMigrationPatch[];
  processMigration: ProcessMigrationInstruction[];
}

/**
 * The full editable migration plan, matching the auto-deploy `*.migration.json` shape. Source and
 * target are NOT part of the plan format — a plan always migrates the instances of its own
 * definition version FROM its predecessor (`basedOnVersionTag`) TO that version, both implied by
 * the definition version the plan is deployed under.
 */
interface MigrationPlan {
  title?: string;
  key?: string;
  migrationTriggers?: MigrationTriggers;
  conditions?: MigrationConditionNode[];
  dataMigration?: DataMigrationPatch[];
  processMigration?: ProcessMigrationInstruction[];
  addBuildingBlock?: AddBuildingBlockInstruction[];
  removeBuildingBlock?: RemoveBuildingBlockInstruction[];
  [key: string]: unknown;
}

export {
  CaseMigrationStatus,
  MigrationTriggers,
  MigrationConditionNode,
  MigrationExecutionError,
  MigrationExecutionStatus,
  DryRunStatus,
  MigrationPlanManagement,
  DataMigrationPatch,
  DataMigrationTargetType,
  ValuePathContext,
  ProcessVariablePatch,
  ProcessMigrationInstruction,
  AddBuildingBlockInstruction,
  RemoveBuildingBlockInstruction,
  MigrationPlan,
};
