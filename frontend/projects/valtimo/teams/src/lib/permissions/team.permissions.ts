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

enum TEAM_PERMISSION_ACTION {
  create = 'create',
  modify = 'modify',
  delete = 'delete',
  assign = 'assign',
}

enum TEAM_PERMISSION_RESOURCE {
  team = 'com.ritense.team.domain.Team',
}

enum USER_PERMISSION_ACTION {
  view_list = 'view_list',
}

enum USER_PERMISSION_RESOURCE {
  user = 'com.ritense.valtimo.contract.authentication.User',
}

const CAN_CREATE_TEAM_PERMISSION: PermissionRequest = {
  action: TEAM_PERMISSION_ACTION.create,
  resource: TEAM_PERMISSION_RESOURCE.team,
};

const CAN_MODIFY_TEAM_PERMISSION: PermissionRequest = {
  action: TEAM_PERMISSION_ACTION.modify,
  resource: TEAM_PERMISSION_RESOURCE.team,
};

const CAN_DELETE_TEAM_PERMISSION: PermissionRequest = {
  action: TEAM_PERMISSION_ACTION.delete,
  resource: TEAM_PERMISSION_RESOURCE.team,
};

const CAN_ASSIGN_TEAM_PERMISSION: PermissionRequest = {
  action: TEAM_PERMISSION_ACTION.assign,
  resource: TEAM_PERMISSION_RESOURCE.team,
};

const CAN_VIEW_USERS_PERMISSION: PermissionRequest = {
  action: USER_PERMISSION_ACTION.view_list,
  resource: USER_PERMISSION_RESOURCE.user,
};

export {
  TEAM_PERMISSION_ACTION,
  TEAM_PERMISSION_RESOURCE,
  USER_PERMISSION_ACTION,
  USER_PERMISSION_RESOURCE,
  CAN_CREATE_TEAM_PERMISSION,
  CAN_MODIFY_TEAM_PERMISSION,
  CAN_DELETE_TEAM_PERMISSION,
  CAN_ASSIGN_TEAM_PERMISSION,
  CAN_VIEW_USERS_PERMISSION,
};
