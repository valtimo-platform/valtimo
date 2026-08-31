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
import {
  AddBuildingBlockInstruction,
  BuildingBlockEntryOwner,
  BuildingBlockEntrySuggestion,
  BuildingBlockInstruction,
  BuildingBlockMode,
  DataMigrationPatch,
  DataMigrationTargetType,
  MigrationEditorApi,
  MigrationEditorTestIds,
  MigrationExecutionError,
  MigrationPlan as BlueprintMigrationPlan,
  MigrationPlanSource,
  ProcessMigrationInstruction,
  ProcessVariablePatch,
  RemoveBuildingBlockInstruction,
  ValuePathContext,
} from '@valtimo/building-block-management';

/*
 * A case migration plan is a blueprint migration plan plus the two things only a case has: triggers
 * that decide when the run starts, and conditions that decide which cases it takes. A building block
 * plan declaring either is refused at deploy time — it has no lifecycle of its own — so the shared
 * shape in `@valtimo/building-block-management` models neither, and everything below adds them back.
 *
 * The plan-shape types are re-exported so the rest of this library keeps importing them from here.
 */

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

/**
 * A case the plan migrated without doing everything it describes — a component found nothing to act
 * on and skipped its work. Not a failure: the case is on its target version and nothing rolled back.
 */
interface MigrationExecutionWarning {
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
  /** Cases that migrated, but for which a component skipped its work. */
  casesWithWarnings: number;
  warnings: MigrationExecutionWarning[];
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
  /** Cases that would migrate, but for which a component would skip its work. */
  casesWithWarnings: number;
  warnings: MigrationExecutionWarning[];
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

/**
 * The full editable migration plan, matching the auto-deploy `*.case-migration.json` shape. The TARGET
 * is not part of it — that is the case definition version the plan is deployed under — but the
 * `source` is, and is required.
 */
interface MigrationPlan extends BlueprintMigrationPlan {
  migrationTriggers?: MigrationTriggers;
  conditions?: MigrationConditionNode[];
}

export {
  AddBuildingBlockInstruction,
  BuildingBlockEntryOwner,
  BuildingBlockEntrySuggestion,
  BuildingBlockInstruction,
  BuildingBlockMode,
  CaseMigrationStatus,
  DataMigrationPatch,
  DataMigrationTargetType,
  DryRunStatus,
  MigrationConditionNode,
  MigrationEditorApi,
  MigrationEditorTestIds,
  MigrationExecutionError,
  MigrationExecutionStatus,
  MigrationExecutionWarning,
  MigrationPlan,
  MigrationPlanManagement,
  MigrationPlanSource,
  MigrationTriggers,
  ProcessMigrationInstruction,
  ProcessVariablePatch,
  RemoveBuildingBlockInstruction,
  ValuePathContext,
};
