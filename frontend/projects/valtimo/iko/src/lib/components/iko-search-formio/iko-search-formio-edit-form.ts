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

export const ikoSearchFormioEditForm = () => ({
  components: [
    {key: 'type', type: 'hidden'},
    {
      type: 'textfield',
      input: true,
      key: 'label',
      label: 'Label',
      placeholder: 'Label',
      defaultValue: 'IKO Search',
      validate: {
        required: true,
      },
    },
    {
      type: 'textfield',
      input: true,
      key: 'key',
      label: 'Property Name',
      placeholder: 'Property Name',
      tooltip: 'The name of this field in the API endpoint.',
      validate: {
        required: true,
      },
    },
    {
      type: 'textfield',
      input: true,
      key: 'customOptions.ikoViewKey',
      label: 'IKO Key',
      placeholder: 'IKO Key',
      tooltip: 'The IKO aggregate key used to load search actions.',
      validate: {
        required: true,
      },
    },
    {
      key: 'tableView',
      type: 'checkbox',
      label: 'Table View',
      tooltip: 'If checked, this value will show up in the table view of the submissions list.',
    },
    {
      key: 'hidden',
      type: 'checkbox',
      label: 'Hidden',
      tooltip:
        'A hidden field is still a part of the form JSON, but is hidden when the form is rendered.',
    },
  ],
});
