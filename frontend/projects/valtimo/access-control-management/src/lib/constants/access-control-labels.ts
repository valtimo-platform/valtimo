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

import {ConditionOperator} from '../models';

const RESOURCE_TYPE_LABEL: Record<string, string> = {
  'com.ritense.case_.domain.definition.CaseDefinition':
    'accessControl.resourceTypes.caseDefinition',
  'com.ritense.case.domain.CaseTab': 'accessControl.resourceTypes.caseTab',
  'com.ritense.case_.domain.tab.CaseWidget': 'accessControl.resourceTypes.caseWidget',
  'com.ritense.case_.domain.tab.CaseWidgetTabWidget':
    'accessControl.resourceTypes.caseWidgetTabWidget',
  'com.ritense.dashboard.domain.Dashboard': 'accessControl.resourceTypes.dashboard',
  'com.ritense.document.domain.impl.JsonSchemaDocument': 'accessControl.resourceTypes.document',
  'com.ritense.document.domain.impl.JsonSchemaDocumentDefinition':
    'accessControl.resourceTypes.documentDefinition',
  'com.ritense.document.domain.impl.snapshot.JsonSchemaDocumentSnapshot':
    'accessControl.resourceTypes.documentSnapshot',
  'com.ritense.document.domain.impl.searchfield.SearchField':
    'accessControl.resourceTypes.searchField',
  'com.ritense.documentenapi.authorization.ZgwDocument': 'accessControl.resourceTypes.zgwDocument',
  'com.ritense.iko.domain.IkoView': 'accessControl.resourceTypes.ikoView',
  'com.ritense.note.domain.Note': 'accessControl.resourceTypes.note',
  'com.ritense.objectenapi.security.Object': 'accessControl.resourceTypes.object',
  'com.ritense.team.domain.Team': 'accessControl.resourceTypes.team',
  'com.ritense.valtimo.contract.authentication.User': 'accessControl.resourceTypes.user',
  'com.ritense.valtimo.operaton.domain.OperatonExecution':
    'accessControl.resourceTypes.operatonExecution',
  'com.ritense.valtimo.operaton.domain.OperatonIdentityLink':
    'accessControl.resourceTypes.operatonIdentityLink',
  'com.ritense.valtimo.operaton.domain.OperatonProcessDefinition':
    'accessControl.resourceTypes.operatonProcessDefinition',
  'com.ritense.valtimo.operaton.domain.OperatonTask': 'accessControl.resourceTypes.operatonTask',
};

const OPERATOR_LABEL: Record<ConditionOperator, string> = {
  '==': 'accessControl.overview.operators.eq',
  '!=': 'accessControl.overview.operators.neq',
  '>': 'accessControl.overview.operators.gt',
  '>=': 'accessControl.overview.operators.gte',
  '<': 'accessControl.overview.operators.lt',
  '<=': 'accessControl.overview.operators.lte',
  in: 'accessControl.overview.operators.in',
  list_contains: 'accessControl.overview.operators.list_contains',
};

const SPECIAL_VALUE_LABEL: Record<string, string> = {
  '${currentUserId}': 'accessControl.overview.specialValues.currentUserId',
  '${currentUsername}': 'accessControl.overview.specialValues.currentUsername',
  '${currentUserEmail}': 'accessControl.overview.specialValues.currentUserEmail',
  '${currentUserRoles}': 'accessControl.overview.specialValues.currentUserRoles',
  '${currentUserTeams}': 'accessControl.overview.specialValues.currentUserTeams',
};

// Field labels per resource type. The lookup key is `(resourceType, field-path)`.
// Field paths mirror the JPA entity property paths (incl. nested embedded ids)
// in the backend domain classes. Unknown paths fall back to a humanized form.
const FIELD_LABEL: Record<string, Record<string, string>> = {
  'com.ritense.case_.domain.definition.CaseDefinition': {
    'id.key': 'accessControl.overview.fields.caseDefinition.idKey',
    'id.versionTag': 'accessControl.overview.fields.caseDefinition.idVersionTag',
    name: 'accessControl.overview.fields.caseDefinition.name',
    description: 'accessControl.overview.fields.caseDefinition.description',
    basedOnVersionTag: 'accessControl.overview.fields.caseDefinition.basedOnVersionTag',
    final: 'accessControl.overview.fields.caseDefinition.final',
    active: 'accessControl.overview.fields.caseDefinition.active',
    canHaveAssignee: 'accessControl.overview.fields.caseDefinition.canHaveAssignee',
    autoAssignTasks: 'accessControl.overview.fields.caseDefinition.autoAssignTasks',
    hasExternalStartForm: 'accessControl.overview.fields.caseDefinition.hasExternalStartForm',
    externalStartFormUrl: 'accessControl.overview.fields.caseDefinition.externalStartFormUrl',
    externalStartFormDescription:
      'accessControl.overview.fields.caseDefinition.externalStartFormDescription',
    originalKey: 'accessControl.overview.fields.caseDefinition.originalKey',
    originalName: 'accessControl.overview.fields.caseDefinition.originalName',
    originalVersionTag: 'accessControl.overview.fields.caseDefinition.originalVersionTag',
    createdBy: 'accessControl.overview.fields.caseDefinition.createdBy',
    createdDate: 'accessControl.overview.fields.caseDefinition.createdDate',
  },
  'com.ritense.case.domain.CaseTab': {
    'id.caseDefinitionId.key': 'accessControl.overview.fields.caseTab.caseDefinitionKey',
    'id.caseDefinitionId.versionTag':
      'accessControl.overview.fields.caseTab.caseDefinitionVersionTag',
    'id.key': 'accessControl.overview.fields.caseTab.idKey',
    name: 'accessControl.overview.fields.caseTab.name',
    tabOrder: 'accessControl.overview.fields.caseTab.tabOrder',
    type: 'accessControl.overview.fields.caseTab.type',
    contentKey: 'accessControl.overview.fields.caseTab.contentKey',
    createdOn: 'accessControl.overview.fields.caseTab.createdOn',
    createdBy: 'accessControl.overview.fields.caseTab.createdBy',
    showTasks: 'accessControl.overview.fields.caseTab.showTasks',
  },
  'com.ritense.case_.domain.tab.CaseWidgetTabWidget': {
    title: 'accessControl.overview.fields.caseWidgetTabWidget.title',
    icon: 'accessControl.overview.fields.caseWidgetTabWidget.icon',
    color: 'accessControl.overview.fields.caseWidgetTabWidget.color',
    order: 'accessControl.overview.fields.caseWidgetTabWidget.order',
    width: 'accessControl.overview.fields.caseWidgetTabWidget.width',
    highContrast: 'accessControl.overview.fields.caseWidgetTabWidget.highContrast',
    isCompact: 'accessControl.overview.fields.caseWidgetTabWidget.isCompact',
  },
  'com.ritense.dashboard.domain.Dashboard': {
    key: 'accessControl.overview.fields.dashboard.key',
    title: 'accessControl.overview.fields.dashboard.title',
    description: 'accessControl.overview.fields.dashboard.description',
    order: 'accessControl.overview.fields.dashboard.order',
    createdBy: 'accessControl.overview.fields.dashboard.createdBy',
    createdOn: 'accessControl.overview.fields.dashboard.createdOn',
  },
  'com.ritense.document.domain.impl.JsonSchemaDocument': {
    id: 'accessControl.overview.fields.document.id',
    'content.content': 'accessControl.overview.fields.document.contentContent',
    'documentDefinitionId.name': 'accessControl.overview.fields.document.documentDefinitionIdName',
    'documentDefinitionId.version':
      'accessControl.overview.fields.document.documentDefinitionIdVersion',
    'documentDefinitionId.caseDefinitionId.key':
      'accessControl.overview.fields.document.documentDefinitionIdCaseDefinitionIdKey',
    'documentDefinitionId.caseDefinitionId.versionTag':
      'accessControl.overview.fields.document.documentDefinitionIdCaseDefinitionIdVersionTag',
    assigneeId: 'accessControl.overview.fields.document.assigneeId',
    assigneeFullName: 'accessControl.overview.fields.document.assigneeFullName',
    assignedTeamKey: 'accessControl.overview.fields.document.assignedTeamKey',
    assignedTeamTitle: 'accessControl.overview.fields.document.assignedTeamTitle',
    version: 'accessControl.overview.fields.document.version',
    createdOn: 'accessControl.overview.fields.document.createdOn',
    modifiedOn: 'accessControl.overview.fields.document.modifiedOn',
    createdBy: 'accessControl.overview.fields.document.createdBy',
    sequence: 'accessControl.overview.fields.document.sequence',
    internalStatus: 'accessControl.overview.fields.document.internalStatus',
    retentionDate: 'accessControl.overview.fields.document.retentionDate',
  },
  'com.ritense.document.domain.impl.JsonSchemaDocumentDefinition': {
    'id.name': 'accessControl.overview.fields.documentDefinition.idName',
    'id.version': 'accessControl.overview.fields.documentDefinition.idVersion',
    createdOn: 'accessControl.overview.fields.documentDefinition.createdOn',
  },
  'com.ritense.document.domain.impl.snapshot.JsonSchemaDocumentSnapshot': {
    id: 'accessControl.overview.fields.documentSnapshot.id',
    createdOn: 'accessControl.overview.fields.documentSnapshot.createdOn',
    createdBy: 'accessControl.overview.fields.documentSnapshot.createdBy',
  },
  'com.ritense.document.domain.impl.searchfield.SearchField': {
    key: 'accessControl.overview.fields.searchField.key',
    title: 'accessControl.overview.fields.searchField.title',
    path: 'accessControl.overview.fields.searchField.path',
    dataType: 'accessControl.overview.fields.searchField.dataType',
    fieldType: 'accessControl.overview.fields.searchField.fieldType',
    matchType: 'accessControl.overview.fields.searchField.matchType',
    order: 'accessControl.overview.fields.searchField.order',
  },
  'com.ritense.documentenapi.authorization.ZgwDocument': {
    caseDocumentId: 'accessControl.overview.fields.zgwDocument.caseDocumentId',
    vertrouwelijkheidaanduiding:
      'accessControl.overview.fields.zgwDocument.vertrouwelijkheidaanduiding',
    status: 'accessControl.overview.fields.zgwDocument.status',
    informatieobjecttypeUrl: 'accessControl.overview.fields.zgwDocument.informatieobjecttypeUrl',
    informatieobjecttypeOmschrijving:
      'accessControl.overview.fields.zgwDocument.informatieobjecttypeOmschrijving',
  },
  'com.ritense.iko.domain.IkoView': {
    key: 'accessControl.overview.fields.ikoView.key',
    title: 'accessControl.overview.fields.ikoView.title',
  },
  'com.ritense.note.domain.Note': {
    id: 'accessControl.overview.fields.note.id',
    createdByUserId: 'accessControl.overview.fields.note.createdByUserId',
    createdByUserFullName: 'accessControl.overview.fields.note.createdByUserFullName',
    createdDate: 'accessControl.overview.fields.note.createdDate',
    content: 'accessControl.overview.fields.note.content',
    documentId: 'accessControl.overview.fields.note.documentId',
  },
  'com.ritense.team.domain.Team': {
    key: 'accessControl.overview.fields.team.key',
    title: 'accessControl.overview.fields.team.title',
    users: 'accessControl.overview.fields.team.users',
  },
  'com.ritense.valtimo.contract.authentication.User': {
    roles: 'accessControl.overview.fields.user.roles',
  },
  'com.ritense.valtimo.operaton.domain.OperatonExecution': {
    id: 'accessControl.overview.fields.operatonExecution.id',
    businessKey: 'accessControl.overview.fields.operatonExecution.businessKey',
    activityId: 'accessControl.overview.fields.operatonExecution.activityId',
    activityInstanceId: 'accessControl.overview.fields.operatonExecution.activityInstanceId',
    active: 'accessControl.overview.fields.operatonExecution.active',
    caseInstanceId: 'accessControl.overview.fields.operatonExecution.caseInstanceId',
    'processInstance.id': 'accessControl.overview.fields.operatonExecution.processInstanceId',
    'processDefinition.id': 'accessControl.overview.fields.operatonExecution.processDefinitionId',
    'processDefinition.key': 'accessControl.overview.fields.operatonExecution.processDefinitionKey',
    'parent.id': 'accessControl.overview.fields.operatonExecution.parentId',
    tenantId: 'accessControl.overview.fields.operatonExecution.tenantId',
  },
  'com.ritense.valtimo.operaton.domain.OperatonIdentityLink': {
    groupId: 'accessControl.overview.fields.operatonIdentityLink.groupId',
    type: 'accessControl.overview.fields.operatonIdentityLink.type',
    userId: 'accessControl.overview.fields.operatonIdentityLink.userId',
    'processDefinition.key':
      'accessControl.overview.fields.operatonIdentityLink.processDefinitionKey',
    tenantId: 'accessControl.overview.fields.operatonIdentityLink.tenantId',
  },
  'com.ritense.valtimo.operaton.domain.OperatonProcessDefinition': {
    id: 'accessControl.overview.fields.operatonProcessDefinition.id',
    category: 'accessControl.overview.fields.operatonProcessDefinition.category',
    name: 'accessControl.overview.fields.operatonProcessDefinition.name',
    key: 'accessControl.overview.fields.operatonProcessDefinition.key',
    version: 'accessControl.overview.fields.operatonProcessDefinition.version',
    versionTag: 'accessControl.overview.fields.operatonProcessDefinition.versionTag',
    deploymentId: 'accessControl.overview.fields.operatonProcessDefinition.deploymentId',
    isStartableInTasklist:
      'accessControl.overview.fields.operatonProcessDefinition.isStartableInTasklist',
    tenantId: 'accessControl.overview.fields.operatonProcessDefinition.tenantId',
  },
  'com.ritense.valtimo.operaton.domain.OperatonTask': {
    id: 'accessControl.overview.fields.operatonTask.id',
    name: 'accessControl.overview.fields.operatonTask.name',
    description: 'accessControl.overview.fields.operatonTask.description',
    taskDefinitionKey: 'accessControl.overview.fields.operatonTask.taskDefinitionKey',
    owner: 'accessControl.overview.fields.operatonTask.owner',
    assignee: 'accessControl.overview.fields.operatonTask.assignee',
    priority: 'accessControl.overview.fields.operatonTask.priority',
    createTime: 'accessControl.overview.fields.operatonTask.createTime',
    lastUpdated: 'accessControl.overview.fields.operatonTask.lastUpdated',
    dueDate: 'accessControl.overview.fields.operatonTask.dueDate',
    followUpDate: 'accessControl.overview.fields.operatonTask.followUpDate',
    caseInstanceId: 'accessControl.overview.fields.operatonTask.caseInstanceId',
    caseDefinitionId: 'accessControl.overview.fields.operatonTask.caseDefinitionId',
    'processInstance.id': 'accessControl.overview.fields.operatonTask.processInstanceId',
    'processDefinition.id': 'accessControl.overview.fields.operatonTask.processDefinitionId',
    'processDefinition.key': 'accessControl.overview.fields.operatonTask.processDefinitionKey',
    tenantId: 'accessControl.overview.fields.operatonTask.tenantId',
  },
};

const NO_CONTEXT_RESOURCE_TYPE = 'com.ritense.authorization.NoContext';

export {NO_CONTEXT_RESOURCE_TYPE};
export {FIELD_LABEL, OPERATOR_LABEL, RESOURCE_TYPE_LABEL, SPECIAL_VALUE_LABEL};
