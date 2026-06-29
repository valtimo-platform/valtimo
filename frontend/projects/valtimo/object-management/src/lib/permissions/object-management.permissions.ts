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

import {PermissionRequest} from '@valtimo/access-control';

enum OBJECT_MANAGEMENT_PERMISSION_ACTION {
  view = 'view',
  view_list = 'view_list',
}

enum OBJECT_MANAGEMENT_PERMISSION_RESOURCE {
  objectManagement = 'com.ritense.objectmanagement.domain.ObjectManagement',
}

const CAN_VIEW_OBJECT_MANAGEMENT_PERMISSION: PermissionRequest = {
  action: OBJECT_MANAGEMENT_PERMISSION_ACTION.view,
  resource: OBJECT_MANAGEMENT_PERMISSION_RESOURCE.objectManagement,
};

const CAN_VIEW_LIST_OBJECT_MANAGEMENT_PERMISSION: PermissionRequest = {
  action: OBJECT_MANAGEMENT_PERMISSION_ACTION.view_list,
  resource: OBJECT_MANAGEMENT_PERMISSION_RESOURCE.objectManagement,
};

export {
  OBJECT_MANAGEMENT_PERMISSION_ACTION,
  OBJECT_MANAGEMENT_PERMISSION_RESOURCE,
  CAN_VIEW_OBJECT_MANAGEMENT_PERMISSION,
  CAN_VIEW_LIST_OBJECT_MANAGEMENT_PERMISSION,
};
