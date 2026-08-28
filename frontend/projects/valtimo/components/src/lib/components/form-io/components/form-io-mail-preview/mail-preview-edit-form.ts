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

export const mailPreviewEditForm = () => ({
  components: [
    {
      key: 'type',
      type: 'hidden',
    },
    {
      key: 'label',
      type: 'hidden',
      defaultValue: 'E-mail preview',
    },
    {
      key: 'customOptions.variableKey',
      type: 'textfield',
      input: true,
      label: 'Variabele sleutel',
      placeholder: 'bijv. mailPreview.ontvangstbevestiging',
      tooltip: 'Het data-pad van de variabele die de e-mailinhoud bevat.',
      validate: {
        required: true,
      },
    },
    {
      key: 'key',
      type: 'hidden',
      calculateValue:
        'value = (data.customOptions && data.customOptions.variableKey) ? data.customOptions.variableKey : value',
    },
    {
      key: 'tableView',
      type: 'checkbox',
      label: 'Table View',
      tooltip: 'If checked, this value will show up in the table view of the submissions list.',
    },
  ],
});
