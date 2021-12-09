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


import {User} from './user-management.model';

export interface Task {
  assignee: string;
  caseDefinitionId: string;
  caseExecutionId: string;
  caseInstanceId: string;
  created: string;
  delegationState: any;
  description: string;
  due: string;
  executionId: string;
  followUp: any;
  formKey: string;
  formless: boolean;
  id: string;
  listItemFields: ListItemField[];
  name: string;
  owner: string;
  parentTaskId: string;
  priority: number;
  processDefinitionId: string;
  processInstanceId: string;
  suspended: boolean;
  taskDefinitionKey: string;
  tenantId: string;
  formLocation: string;
  businessKey: string;
  processDefinitionKey: string;
  valtimoAssignee: User;
}

interface ListItemField {
  key: string;
  value: string;
  label: string;
}

export interface AssigneeRequest {
  assignee: string;
}
