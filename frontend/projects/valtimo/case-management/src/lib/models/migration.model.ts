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

export {
  CaseMigrationStatus,
  MigrationTriggers,
  MigrationCondition,
  MigrationExecutionError,
  MigrationExecutionStatus,
  MigrationPlanManagement,
};
