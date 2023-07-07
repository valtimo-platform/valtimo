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

type PermissionRequestQueue = Array<PermissionRequest>;

interface PermissionResponse {
  request: PermissionRequest;
  available: boolean;
}

interface CachedResolvedPermissions {
  [permissionRequestKey: string]: boolean;
}

interface PendingPermissions {
  [permissionRequestKey: string]: Subject<boolean>;
}

interface ResolvedPermissions {
  [permissionRequestKey: string]: boolean;
}

export {
  CachedResolvedPermissions,
  PendingPermissions,
  PermissionContext,
  PermissionRequest,
  PermissionRequestQueue,
  PermissionResponse,
  ResolvedPermissions,
};
