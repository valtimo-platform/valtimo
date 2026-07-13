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
  status: BuildingBlockMigrationStatus;
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
  source: string;
  target: string;
  triggers: MigrationTriggers;
  conditions: MigrationCondition[];
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

interface MigrationPlan {
  title?: string;
  key?: string;
  migrationTriggers?: MigrationTriggers;
  conditions?: MigrationCondition[];
  dataMigration?: DataMigrationPatch[];
  processMigration?: ProcessMigrationInstruction[];
  [key: string]: unknown;
}

export {
  BuildingBlockMigrationStatus,
  BuildingBlockMigrationParams,
  MigrationTriggers,
  MigrationCondition,
  MigrationExecutionError,
  MigrationExecutionStatus,
  MigrationPlanManagement,
  DataMigrationTargetType,
  DataMigrationPatch,
  ValuePathContext,
  ProcessVariablePatch,
  ProcessMigrationInstruction,
  MigrationPlan,
};
