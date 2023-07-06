import {Subject} from 'rxjs';

interface PermissionContext {
  identifier: string;
  resource: string;
}

interface PermissionRequest {
  action: string;
  resource: string;
  context?: PermissionContext;
}

interface PermissionRequestCollection {
  [key: string]: PermissionRequest;
}

interface PermissionResponse {
  request: PermissionRequest;
  available: boolean;
}

interface CachedResolvedPermissions {
  [collectionKey: string]: {
    [permissionRequestCollectionKey: string]: boolean;
  };
}

interface PendingPermissions {
  [collectionKey: string]: {
    [permissionRequestCollectionKey: string]: Subject<boolean>;
  };
}

interface ResolvedPermissions {
  [permissionRequestCollectionKey: string]: boolean;
}

export {
  CachedResolvedPermissions,
  PendingPermissions,
  PermissionContext,
  PermissionRequest,
  PermissionRequestCollection,
  PermissionResponse,
  ResolvedPermissions,
};
