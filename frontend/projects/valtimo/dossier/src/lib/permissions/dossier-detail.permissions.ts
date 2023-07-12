import {PermissionRequest} from '@valtimo/access-control';

enum PERMISSION_ACTION {
  add = 'create',
  assign = 'assign',
  claim = 'claim',
  delete = 'delete',
  edit = 'modify',
}

enum DOSSIER_DETAIL_PERMISSION_RESOURCE {
  domain = 'com.ritense.document.domain.impl.JsonSchemaDocument',
  note = 'com.ritense.note.domain.Note',
}

const CAN_CLAIM_CASE_PERMISSION: PermissionRequest = {
  action: PERMISSION_ACTION.claim,
  resource: DOSSIER_DETAIL_PERMISSION_RESOURCE.domain,
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
  resource: DOSSIER_DETAIL_PERMISSION_RESOURCE.domain,
};

export {
  CAN_ADD_NOTE_PERMISSION,
  CAN_ASSIGN_CASE_PERMISSION,
  CAN_CLAIM_CASE_PERMISSION,
  CAN_DELETE_NOTE_PERMISSION,
  CAN_EDIT_NOTE_PERMISSION,
  DOSSIER_DETAIL_PERMISSION_RESOURCE,
};
