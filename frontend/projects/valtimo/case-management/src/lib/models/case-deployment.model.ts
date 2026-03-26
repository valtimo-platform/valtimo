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

export class CaseDefinition {
  caseDefinitionKey: string;
  caseDefinitionVersionTag: string;
  name: string;
  description: string;
  createdBy: string;
  createdDate: Date;
  basedOnVersionTag: string;
  final: boolean;
  canHaveAssignee: boolean;
  autoAssignTasks: boolean;
  active: boolean;
  conflictingVersions: string;
}

export class ReleaseVersionData {
  caseDefinitionVersionTag: string;
  basedOnVersionTag: string;
}

export class ReleaseInformationData {
  createdBy: string;
  createdDate: Date;
  description: string;
}

export class DraftVersion {
  name: string;
  caseDefinitionKey: string;
  caseDefinitionVersion: string;
  description: string;
  basedOnCaseDefinitionVersion?: string;
}

export interface CaseDefinitionFinalizationCheckResult {
  finalizable: boolean;
  code: string;
}

export interface CaseDefinitionConfigurationIssue {
  id: string;
  issueType: string;
  resolved: boolean;
  createdAt: string;
  resolvedAt: string | null;
}

export interface CaseDefinitionImportPreview {
  key: string;
  name: string;
  versionTag: string;
  isFinal: boolean;
}

export interface ConfigurationIssueUpdatedSseEvent {
  eventType?: string;
  caseDefinitionKey: string;
  caseDefinitionVersionTag: string;
}
