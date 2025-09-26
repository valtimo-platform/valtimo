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

export const formIoCurrentUserEditForm = () => ({
  components: [
    {
      key: 'type',
      type: 'hidden',
    },
    {
      key: 'label',
      type: 'textfield',
      input: true,
      label: 'Label',
      placeholder: 'Label',
      defaultValue: 'Valtimo Current User',
      validate: {
        required: true,
      },
    },
    {
      key: 'key',
      type: 'textfield',
      input: true,
      label: 'Property Name',
      placeholder: 'Property Name',
      tooltip: 'The name of this field in the API endpoint.',
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
      key: 'hideLabel',
      type: 'checkbox',
      label: 'Hide Label',
      tooltip:
        'Hide the label of this component. This setting will display the label in the form builder, but hide the label when the form is rendered.',
    },
    {
      key: 'hidden',
      type: 'checkbox',
      label: 'Hidden',
      tooltip:
        'A hidden field is still a part of the form JSON, but is hidden when viewing the form is rendererd.',
    },
  ],
});
