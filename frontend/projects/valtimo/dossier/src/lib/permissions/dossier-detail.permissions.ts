import {PermissionRequest} from '@valtimo/access-control';

enum PERMISSION_ACTION {
  claim = 'CLAIM',
  assign = 'ASSIGN',
}

enum DOSSIER_DETAIL_PERMISSION_RESOURCE {
  domain = 'com.ritense.document.domain.impl.JsonSchemaDocument',
}

const CAN_CLAIM_CASE_PERMISSION: PermissionRequest = {
  action: PERMISSION_ACTION.claim,
  resource: DOSSIER_DETAIL_PERMISSION_RESOURCE.domain,
};

const CAN_ASSIGN_CASE_PERMISSION: PermissionRequest = {
  action: PERMISSION_ACTION.assign,
  resource: DOSSIER_DETAIL_PERMISSION_RESOURCE.domain,
};

export {CAN_CLAIM_CASE_PERMISSION, CAN_ASSIGN_CASE_PERMISSION, DOSSIER_DETAIL_PERMISSION_RESOURCE};
