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
import {formioValueResolverSelectorEditForm} from './formio-value-resolver-selector-edit-form';
import {FormioValueResolverSelectorComponent} from './formio-value-resolver-selector.component';
import {ValtimoWindow} from '@valtimo/config';

declare var window;

const COMPONENT_OPTIONS: FormioCustomComponentInfo = {
  type: 'valtimo-value-resolver-selector',
  selector: 'valtimo-value-resolver-selector',
  title: 'Valtimo value resolver selector',
  group: 'none',
  icon: 'user',
  editForm: formioValueResolverSelectorEditForm,
  schema: {
    label: 'Valtimo value resolver selector',
    tableView: true,
  },
};

export function registerFormioValueResolverSelectorComponent(injector: Injector) {
  // @ts-ignore
  registerCustomFormioComponent(COMPONENT_OPTIONS, FormioValueResolverSelectorComponent, injector);

  setTimeout(() => {
    let valtimoWindow = window as ValtimoWindow;

    valtimoWindow.flags = {
      ...valtimoWindow.flags,
      formioValueResolverSelectorComponentRegistered: true,
    };
  });
}
