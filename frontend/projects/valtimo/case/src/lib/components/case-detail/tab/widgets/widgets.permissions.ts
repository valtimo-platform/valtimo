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
  create = 'create',
}

enum WIDGET_PERMISSION_RESOURCE {
  camundaExecution = 'com.ritense.valtimo.operaton.domain.OperatonExecution',
  camundaProcessDefinition = 'com.ritense.valtimo.operaton.domain.OperatonProcessDefinition',
}

const CAN_CREATE_CAMUNDA_EXECUTION_PERMISSION: PermissionRequest = {
  action: PERMISSION_ACTION.create,
  resource: WIDGET_PERMISSION_RESOURCE.camundaExecution,
};

export {CAN_CREATE_CAMUNDA_EXECUTION_PERMISSION, WIDGET_PERMISSION_RESOURCE};
