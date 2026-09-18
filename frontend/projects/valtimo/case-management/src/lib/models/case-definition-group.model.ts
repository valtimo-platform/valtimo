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

interface CaseDefinitionGroupCreateRequest {
  title: string;
  description?: string;
  color?: string;
}

interface CaseDefinitionGroupUpdateRequest {
  title: string;
  description?: string;
  color?: string;
}

interface CaseDefinitionGroupResponse {
  key: string;
  title: string;
  description?: string;
  color?: string;
  order: number;
  memberCount: number;
  createdBy: string;
  createdOn: string;
}

interface CaseDefinitionGroupWithMembersResponse {
  key: string;
  title: string;
  description?: string;
  color?: string;
  order: number;
  members: GroupMember[];
  createdBy: string;
  createdOn: string;
}

interface GroupMember {
  caseDefinitionKey: string;
  caseDefinitionName?: string;
  order: number;
}

interface GroupListColumnRequest {
  key: string;
  title?: string;
  displayType: GroupDisplayType;
  sortable: boolean;
  defaultSort?: 'ASC' | 'DESC';
  exportable: boolean;
  pathMappings?: GroupPathMapping[];
}

interface GroupDisplayType {
  type: string;
  displayTypeParameters?: Record<string, unknown>;
}

interface GroupSearchFieldRequest {
  key: string;
  title?: string;
  dataType: string;
  fieldType: string;
  matchType?: string;
  dropdownDataProvider?: string;
}

interface GroupPathMapping {
  caseDefinitionKey: string;
  path: string;
}

interface GroupMemberOrderRequest {
  caseDefinitionKeys: string[];
}

interface AddGroupMemberRequest {
  caseDefinitionKey: string;
}

export {
  AddGroupMemberRequest,
  CaseDefinitionGroupCreateRequest,
  CaseDefinitionGroupResponse,
  CaseDefinitionGroupUpdateRequest,
  CaseDefinitionGroupWithMembersResponse,
  GroupDisplayType,
  GroupListColumnRequest,
  GroupMember,
  GroupMemberOrderRequest,
  GroupPathMapping,
  GroupSearchFieldRequest,
};
