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
import {TranslateService} from '@ngx-translate/core';
import {FormIoIbanComponent} from './iban.component';
import {FormioCustomComponentInfo, registerCustomFormioComponent} from '../../../../modules';
import {isValidIban} from './iban.validators';

const ERROR_MESSAGE_TRANSLATION_KEY = 'formioTranslations.formioIbanComponent.errorMessage';

const getComponentOptions = (injector: Injector): FormioCustomComponentInfo => ({
  type: 'iban',
  selector: 'valtimo-iban',
  title: 'Iban',
  group: 'basic',
  icon: 'bank',
  schema: {
    label: 'Iban component',
    key: 'iban',
    hideLabel: false,
    tableView: true,
    validate: {
      required: false,
    },
  },
  customValidator: (value: string) =>
    isValidIban(value)
      ? null
      : injector.get(TranslateService).instant(ERROR_MESSAGE_TRANSLATION_KEY),
});

export function registerFormioIbanComponent(injector: Injector) {
  registerCustomFormioComponent(getComponentOptions(injector), FormIoIbanComponent, injector);
}
