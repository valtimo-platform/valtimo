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

import {Injector} from '@angular/core';
import {FormIoCurrencyComponent} from './currency.component';
import {FormioCustomComponentInfo, registerCustomFormioComponent} from '../../../../modules';
import {currencyEditForm} from './currency-edit-form';

const COMPONENT_OPTIONS: FormioCustomComponentInfo = {
  type: 'currency',
  selector: 'valtimo-currency',
  title: 'Currency',
  group: 'basic',
  icon: 'dollar',
  schema: {
    label: 'Currency component',
    key: 'currency',
    hideLabel: false,
    tableView: true,
    validate: {
      required: false,
    },
  },
  editForm: currencyEditForm,
};

export function registerFormioCurrencyComponent(injector: Injector) {
  registerCustomFormioComponent(COMPONENT_OPTIONS, FormIoCurrencyComponent, injector);
}
