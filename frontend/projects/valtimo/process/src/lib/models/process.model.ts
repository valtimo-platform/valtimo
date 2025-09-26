/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

interface ProcessStart {
  key: string;
  businessKey: string;
  variables: Array<any>;
}

interface Process {
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

interface ProcessDefinition {
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

interface ProcessDefinitionStartForm {
  formFields: Array<any>;
  formLocation: string;
  genericForm: boolean;
}

type StartProcessLinkType = 'form' | 'form-flow' | 'form-view-model' | 'url' | 'ui-component';

interface ProcessDefinitionStartProcessLink {
  processLinkId: string;
  type: StartProcessLinkType;
  properties: {
    formFlowInstanceId?: string;
    formDefinitionId?: string;
    prefilledForm?: any;
    formName?: string;
    formDefinition?: object;
    url?: string;
    componentKey?: string;
  };
}

interface ProcessInstance {
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

interface ProcessInstanceVariable {
  id: string;
  type: string;
  name: string;
  textValue?: string;
  longValue?: number;
  local: boolean;
}

interface ProcessInstanceTask {
  id: string;
  name: string;
  assignee: string;
  created: string;
  createdUnix: number;
  due?: string;
  dueUnix?: number;
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
  isLocked: boolean;
}

interface IdentityLink {
  userId: string;
  groupId: string;
  type: string;
}

interface ProcessDefinitionXml {
  bpmn20Xml: string;
  id: string;
  readOnly: boolean;
  systemProcess: boolean;
}

export {
  ProcessStart,
  Process,
  ProcessDefinition,
  ProcessDefinitionStartForm,
  StartProcessLinkType,
  ProcessDefinitionStartProcessLink,
  ProcessInstance,
  ProcessInstanceVariable,
  ProcessInstanceTask,
  IdentityLink,
  ProcessDefinitionXml,
};
