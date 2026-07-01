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

import {PermissionCondition} from './permission.model';

// The condition kinds supported by the form editor. Mirrors the backend
// PermissionConditionType discriminator (serialized lowercase as the "type" property).
type ConditionType = 'field' | 'expression' | 'container';

// The exact shape expected by PUT /api/management/v1/roles/{roleKey}/permissions
// (com.ritense.authorization.web.request.UpdateRolePermissionRequest). The form editor
// serializes its reactive form to a list of these.
interface UpdateRolePermission {
  resourceType: string;
  actions: string[];
  conditions: PermissionCondition[];
  contextResourceType?: string;
  contextConditions?: PermissionCondition[];
}

export {ConditionType, UpdateRolePermission};
