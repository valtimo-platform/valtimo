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

/* A case plan is a blueprint plan plus triggers and conditions, which a building block plan is refused at deploy time. The plan-shape types are re-exported so the rest of this library imports them from here. */

type CaseMigrationStatus = 'NOT_STARTED' | 'RUNNING' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS';

interface MigrationTriggers {
  triggeredByButton: boolean;
  scheduledAtDate: string | null;
  runAfter: string | null;
}

/** A gating condition, or a group combined with AND (`allOf`) / OR (`anyOf`). */
type MigrationConditionNode = ValueConditionNode;

/** A case the plan migrated without doing everything it describes — a component found nothing to act on. Not a failure. */
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

/** The result of a plan's latest dry run: how many cases would migrate, how many would fail, and why. */
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

/** The full editable plan, matching the auto-deploy `*.case-migration.json` shape. The target is the version it is deployed under; the required `source` is part of it. */
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
