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

import {CaseTag, Document, DocumentDefinitionId, RelatedFile} from '@valtimo/document';

interface DocumentInspection {
  id: string;
  definitionId: DocumentDefinitionId;
  createdOn: string;
  modifiedOn: string | null;
  createdBy: string | null;
  sequence: number | null;
  version: number | null;
  assigneeId: string | null;
  assigneeFullName: string | null;
  assignedTeamKey: string | null;
  assignedTeamTitle: string | null;
  internalStatus: string | null;
  caseTags: CaseTag[];
  relations: string[];
  relatedFiles: RelatedFile[];
  content: Record<string, unknown>;
}

interface Incident {
  id: string;
  processInstanceId: string;
  processDefinitionId: string;
  executionId: string | null;
  activityId: string | null;
  incidentType: string;
  incidentMessage: string | null;
  incidentTimestamp: string;
  causeIncidentId: string | null;
  rootCauseIncidentId: string | null;
  configuration: string | null;
  tenantId: string | null;
  jobDefinitionId: string | null;
}

interface ProcessVariable {
  name: string;
  type: string;
  value: unknown;
}

type ProcessJobType = 'TIMER' | 'ASYNC_CONTINUATION' | 'MESSAGE' | 'BATCH' | 'OTHER';

interface ProcessJob {
  id: string;
  jobDefinitionId: string | null;
  executionId: string | null;
  activityId: string | null;
  jobType: ProcessJobType;
  retries: number;
  exceptionMessage: string | null;
  dueDate: string | null;
  suspended: boolean;
}

interface ProcessTask {
  id: string;
  name: string | null;
  assignee: string | null;
  created: string | null;
  dueDate: string | null;
  taskDefinitionKey: string | null;
}

interface BuildingBlockProcessReference {
  instanceId: string;
  definitionKey: string;
  definitionVersionTag: string;
  documentId: string;
}

interface ProcessInstanceInspection {
  processInstanceId: string;
  processDefinitionId: string | null;
  processDefinitionKey: string | null;
  processName: string | null;
  version: number;
  latestVersion: number;
  active: boolean;
  startedBy: string | null;
  startedByUserId: string | null;
  startedOn: string | null;
  incidents: Incident[];
  tasks: ProcessTask[];
  variables: ProcessVariable[];
  jobs: ProcessJob[];
  buildingBlock: BuildingBlockProcessReference | null;
}

interface BuildingBlockInstance {
  id: string;
  documentId: string;
  caseDocumentId: string | null;
  definitionKey: string;
  definitionVersionTag: string;
  activityId: string | null;
  callerProcessDefinitionId: string | null;
  processInstanceId: string | null;
  parentBuildingBlockInstanceId: string | null;
  rootBuildingBlockInstanceId: string | null;
}

interface ModifyDocumentRequest {
  documentId: string;
  content: object;
}

interface ModifyDocumentResult {
  document?: Document;
  errors?: string[];
}

export {
  Incident,
  ProcessVariable,
  ProcessJob,
  ProcessJobType,
  ProcessTask,
  ProcessInstanceInspection,
  BuildingBlockProcessReference,
  BuildingBlockInstance,
  DocumentInspection,
  ModifyDocumentRequest,
  ModifyDocumentResult,
};
