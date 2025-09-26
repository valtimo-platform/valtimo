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

import {Injector} from '@angular/core';
import {FormioCustomComponentInfo, registerCustomFormioComponent} from '../../../modules';
import {formIoCurrentUserEditForm} from './form-io-current-user-edit-form';
import {FormIoCurrentUserComponent} from './form-io-current-user.component';

const COMPONENT_OPTIONS: FormioCustomComponentInfo = {
  type: 'valtimo-current-user',
  selector: 'valtimo-form-io-current-user',
  title: 'Valtimo Current User',
  group: 'basic',
  icon: 'user',
  editForm: formIoCurrentUserEditForm,
  schema: {
    label: 'Valtimo Current User',
    tableView: true,
  },
};

export function registerFormioCurrentUserComponent(injector: Injector) {
  registerCustomFormioComponent(COMPONENT_OPTIONS, FormIoCurrentUserComponent, injector);
}
