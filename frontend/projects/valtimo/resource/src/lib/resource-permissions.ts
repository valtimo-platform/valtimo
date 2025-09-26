/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
  view = 'view',
  view_list = 'view_list',
  create = 'create',
  modify = 'modify',
  delete = 'delete',
}

enum RESOURCE_PERMISSION_RESOURCE {
  resourcePermission = 'com.ritense.resource.authorization.ResourcePermission',
  jsonSchemaDocument = 'com.ritense.document.domain.impl.JsonSchemaDocument',
}

const CAN_VIEW_RESOURCE_PERMISSION: PermissionRequest = {
  action: PERMISSION_ACTION.view,
  resource: RESOURCE_PERMISSION_RESOURCE.resourcePermission,
};

const CAN_VIEW_LIST_RESOURCE_PERMISSION: PermissionRequest = {
  action: PERMISSION_ACTION.view_list,
  resource: RESOURCE_PERMISSION_RESOURCE.resourcePermission,
};

const CAN_CREATE_RESOURCE_PERMISSION: PermissionRequest = {
  action: PERMISSION_ACTION.create,
  resource: RESOURCE_PERMISSION_RESOURCE.resourcePermission,
};

const CAN_MODIFY_RESOURCE_PERMISSION: PermissionRequest = {
  action: PERMISSION_ACTION.modify,
  resource: RESOURCE_PERMISSION_RESOURCE.resourcePermission,
};

const CAN_DELETE_RESOURCE_PERMISSION: PermissionRequest = {
  action: PERMISSION_ACTION.delete,
  resource: RESOURCE_PERMISSION_RESOURCE.resourcePermission,
};

export {
  CAN_VIEW_RESOURCE_PERMISSION,
  CAN_VIEW_LIST_RESOURCE_PERMISSION,
  CAN_CREATE_RESOURCE_PERMISSION,
  CAN_MODIFY_RESOURCE_PERMISSION,
  CAN_DELETE_RESOURCE_PERMISSION,
  RESOURCE_PERMISSION_RESOURCE,
};
