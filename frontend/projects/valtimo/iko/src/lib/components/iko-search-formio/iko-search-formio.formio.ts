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

import {Injector} from '@angular/core';
import {FormioCustomComponentInfo, registerCustomFormioComponent} from '@valtimo/components';
import {IkoSearchFormioComponent} from './iko-search-formio.component';
import {ikoSearchFormioEditForm} from './iko-search-formio-edit-form';

const COMPONENT_OPTIONS: FormioCustomComponentInfo = {
  type: 'iko-search',
  selector: 'valtimo-iko-search-formio',
  title: 'IKO Search',
  group: 'advanced',
  icon: 'search',
  fieldOptions: ['label'],
  editForm: ikoSearchFormioEditForm,
  schema: {
    label: 'IKO Search',
    hideLabel: true,
    tableView: true,
  },
};

export function registerIkoSearchFormioComponent(injector: Injector) {
  if (!customElements.get(COMPONENT_OPTIONS.selector)) {
    registerCustomFormioComponent(COMPONENT_OPTIONS, IkoSearchFormioComponent, injector);
  }
}
