import {PermissionRequestCollection} from '@valtimo/access-control';

enum PERMISSION_ACTION {
  claim = 'CLAIM',
}

enum DOSSIER_DETAIL_PERMISSION_RESOURCE {
  domain = 'com.ritense.document.domain.impl.JsonSchemaDocument',
}

enum DOSSIER_DETAIL_PERMISSIONS_KEYS {
  canClaimCase,
}

const DOSSIER_DETAIL_PERMISSIONS: PermissionRequestCollection = {
  [DOSSIER_DETAIL_PERMISSIONS_KEYS.canClaimCase]: {
    action: PERMISSION_ACTION.claim,
    resource: DOSSIER_DETAIL_PERMISSION_RESOURCE.domain,
  },
};

export {
  DOSSIER_DETAIL_PERMISSIONS_KEYS,
  DOSSIER_DETAIL_PERMISSIONS,
  DOSSIER_DETAIL_PERMISSION_RESOURCE,
};
