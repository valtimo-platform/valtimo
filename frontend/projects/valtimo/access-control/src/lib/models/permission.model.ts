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
