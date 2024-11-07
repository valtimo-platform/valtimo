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

import {Components} from 'formiojs';

const TextFieldEditForm = Components.components.textfield.editForm;

export const currencyEditForm = () => {
  const editForm = TextFieldEditForm();

  const localeSelection = {
    type: 'select',
    input: true,
    key: 'customOptions.currencyLocale',
    label: 'Currency locale',
    tooltip: 'The locale used for the currency input',
    weight: 20,
    defaultValue: 'nl-NL',
    dataSrc: 'values',
    data: {
      values: [
        {
          label: 'Dutch (Netherlands)',
          value: 'nl-NL',
        },
        {
          label: 'English (US)',
          value: 'en-US',
        },
        {
          label: 'English (UK)',
          value: 'en-GB',
        },
        {
          label: 'German',
          value: 'de-DE',
        },
      ],
    },
  };

  const currencySelection = {
    type: 'select',
    input: true,
    key: 'customOptions.currencyCurrency',
    label: 'Currency',
    tooltip: 'The currency used for the currency input',
    weight: 20,
    defaultValue: 'EUR',
    dataSrc: 'values',
    data: {
      values: [
        {
          label: 'Euro',
          value: 'EUR',
        },
        {
          label: 'British pound',
          value: 'GBP',
        },
        {
          label: 'United States Dollar',
          value: 'USD',
        },
      ],
    },
  };

  const allowEmptyValueCheckbox = {
    type: 'checkbox',
    input: true,
    key: 'customOptions.allowEmptyValue',
    label: 'Allow Empty Value',
    tooltip: 'Check to allow empty values for this field',
    weight: 10,
    defaultValue: false, // Default to false
  };

  const tabsComponent = editForm.components.find(component => component.key === 'tabs');
  if (tabsComponent) {
    const displayTab = tabsComponent.components.find(tab => tab.key === 'display');
    if (displayTab) {
      displayTab.components.unshift(localeSelection);
      displayTab.components.unshift(currencySelection);
      displayTab.components.unshift(allowEmptyValueCheckbox);
    }
  }

  return editForm;
};
