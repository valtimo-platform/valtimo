/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

import {PermissionRequest} from '@valtimo/access-control';

enum PERMISSION_ACTION {
  add = 'create',
  assign = 'assign',
  claim = 'claim',
  delete = 'delete',
  edit = 'modify',
  view = 'view',
}

enum DOSSIER_DETAIL_PERMISSION_RESOURCE {
  jsonSchemaDocument = 'com.ritense.document.domain.impl.JsonSchemaDocument',
  note = 'com.ritense.note.domain.Note',
  jsonSchemaDocumentDefinition = 'com.ritense.document.domain.impl.JsonSchemaDocumentDefinition',
}

const CAN_CLAIM_CASE_PERMISSION: PermissionRequest = {
  action: PERMISSION_ACTION.claim,
  resource: DOSSIER_DETAIL_PERMISSION_RESOURCE.jsonSchemaDocument,
};

const CAN_ADD_NOTE_PERMISSION: PermissionRequest = {
  action: PERMISSION_ACTION.add,
  resource: DOSSIER_DETAIL_PERMISSION_RESOURCE.note,
};

const CAN_DELETE_NOTE_PERMISSION: PermissionRequest = {
  action: PERMISSION_ACTION.delete,
  resource: DOSSIER_DETAIL_PERMISSION_RESOURCE.note,
};

const CAN_EDIT_NOTE_PERMISSION: PermissionRequest = {
  action: PERMISSION_ACTION.edit,
  resource: DOSSIER_DETAIL_PERMISSION_RESOURCE.note,
};

const CAN_ASSIGN_CASE_PERMISSION: PermissionRequest = {
  action: PERMISSION_ACTION.assign,
  resource: DOSSIER_DETAIL_PERMISSION_RESOURCE.jsonSchemaDocument,
};

const CAN_VIEW_CASE_PERMISSION: PermissionRequest = {
  action: PERMISSION_ACTION.view,
  resource: DOSSIER_DETAIL_PERMISSION_RESOURCE.jsonSchemaDocument,
};

const CAN_CREATE_CASE_PERMISSION: PermissionRequest = {
  action: PERMISSION_ACTION.add,
  resource: DOSSIER_DETAIL_PERMISSION_RESOURCE.jsonSchemaDocument,
};

export {
  CAN_ADD_NOTE_PERMISSION,
  CAN_ASSIGN_CASE_PERMISSION,
  CAN_CLAIM_CASE_PERMISSION,
  CAN_DELETE_NOTE_PERMISSION,
  CAN_EDIT_NOTE_PERMISSION,
  DOSSIER_DETAIL_PERMISSION_RESOURCE,
  CAN_VIEW_CASE_PERMISSION,
  CAN_CREATE_CASE_PERMISSION,
};
