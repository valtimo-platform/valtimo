/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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

export interface ProcessStart {
  key: string;
  businessKey: string;
  variables: Array<any>;
}

export interface Process {
  id: string;
  businessKey: string;
  startTime: string;
  endTime: string;
  processDefinitionKey: string;
  processDefinitionName: string;
  startUserId: string;
  deleteReason: string;
  startUser: string;
  processStarted: string;
  processEnded: string;
  active: boolean;
  variables: ProcessInstanceVariable[];
}

export interface ProcessDefinition {
  visibleInMenu: any;
  category: string;
  deploymentId: string;
  description: string;
  diagram: string;
  historyTimeToLive: string;
  id: string;
  key: string;
  name: string;
  resource: string;
  startableInTasklist: boolean;
  suspended: false;
  tenantId: string;
  version: number;
  versionTag: string;
}

export interface ProcessDefinitionStartForm {
  formFields: Array<any>;
  formLocation: string;
  genericForm: boolean;
}

export interface ProcessInstance {
  id: string;
  businessKey: string;
  startTime: string;
  endTime: string;
  processDefinitionKey: string;
  processDefinitionName: string;
  startUserId: string;
  deleteReason: string;
  variables: ProcessInstanceVariable[];
}

export interface ProcessInstanceVariable {
  id: string;
  type: string;
  name: string;
  textValue?: string;
  longValue?: number;
  local: boolean;
}

export interface ProcessInstanceTask {
  id: string;
  name: string;
  assignee: string;
  created: string;
  createdUnix: number;
  due: string;
  followUp: string;
  delegationState: string;
  description: string;
  executionId: string;
  owner: string;
  parentTaskId: string;
  priority: number;
  processDefinitionId: string;
  processInstanceId: string;
  taskDefinitionKey: string;
  caseExecutionId: string;
  caseInstanceId: string;
  caseDefinitionId: string;
  suspended: boolean;
  formKey: string;
  tenantId: string;
  identityLinks: IdentityLink[];

  isLocked(): boolean;
}

export interface IdentityLink {
  userId: string;
  groupId: string;
  type: string;
}
