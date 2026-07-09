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

type CaseMigrationStatus = 'NOT_STARTED' | 'RUNNING' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS';

interface MigrationTriggers {
  triggeredByButton: boolean;
  scheduledAtDate: string | null;
  runAfter: string | null;
}

interface MigrationCondition {
  path: string;
  operator: string;
  value: unknown;
}

interface MigrationExecutionError {
  caseId: string;
  message: string | null;
}

interface MigrationExecutionStatus {
  status: CaseMigrationStatus;
  casesToMigrate: number;
  casesMigrated: number;
  casesWithErrors: number;
  errors: MigrationExecutionError[];
  startedOn: string | null;
  finishedOn: string | null;
}

interface MigrationPlanManagement {
  migrationKey: string;
  title: string | null;
  triggers: MigrationTriggers;
  conditions: MigrationCondition[];
  components: string[];
  status: MigrationExecutionStatus;
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

/** A single instruction of the `processMigration` block, translated 1:1 into an Operaton MigrationPlan. */
interface ProcessMigrationInstruction {
  sourceProcessDefinitionKey: string;
  targetProcessDefinitionKey: string;
  /** Source activity id -> target activity id (or `<SKIP_MIGRATION>`). */
  mapActivities: {[sourceActivityId: string]: string};
  /** GZAC-layer process variables set on the migrated instance. */
  newProcessVariables: {[name: string]: unknown};
  skipCustomListeners: boolean;
  skipIoMappings: boolean;
}

type BlueprintType = 'CASE' | 'BUILDING_BLOCK';

/** The full editable migration plan, matching the auto-deploy `*.migration.json` shape. */
interface MigrationPlan {
  title?: string;
  key?: string;
  /**
   * Optional blueprint this plan migrates FROM. When omitted it defaults (at runtime) to the
   * resolved target's blueprint type/key and the target blueprint's `basedOnVersionTag`.
   */
  sourceBlueprintType?: BlueprintType | null;
  sourceKey?: string | null;
  sourceVersionTag?: string | null;
  /**
   * Optional blueprint this plan migrates TO. When omitted it defaults (at runtime) to the
   * blueprint version the plan is deployed under.
   */
  targetBlueprintType?: BlueprintType | null;
  targetKey?: string | null;
  targetVersionTag?: string | null;
  migrationTriggers?: MigrationTriggers;
  conditions?: MigrationCondition[];
  dataMigration?: DataMigrationPatch[];
  processMigration?: ProcessMigrationInstruction[];
  [key: string]: unknown;
}

export {
  CaseMigrationStatus,
  BlueprintType,
  MigrationTriggers,
  MigrationCondition,
  MigrationExecutionError,
  MigrationExecutionStatus,
  MigrationPlanManagement,
  DataMigrationPatch,
  DataMigrationTargetType,
  ProcessMigrationInstruction,
  MigrationPlan,
};
