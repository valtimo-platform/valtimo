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

import {buildCustomComponentEditForm} from '../../form-io-edit-form.utils';

const currentUserDisplayComponents = [
  {
    key: 'label',
    type: 'textfield',
    input: true,
    label: 'Label',
    placeholder: 'Label',
    defaultValue: 'Valtimo Current User',
    weight: 0,
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
    weight: 10,
    validate: {
      required: true,
    },
  },
  {
    key: 'tableView',
    type: 'checkbox',
    input: true,
    label: 'Table View',
    tooltip: 'If checked, this value will show up in the table view of the submissions list.',
    weight: 20,
  },
  {
    key: 'hideLabel',
    type: 'checkbox',
    input: true,
    label: 'Hide Label',
    tooltip:
      'Hide the label of this component. This setting will display the label in the form builder, but hide the label when the form is rendered.',
    weight: 30,
  },
  {
    key: 'hidden',
    type: 'checkbox',
    input: true,
    label: 'Hidden',
    tooltip:
      'A hidden field is still a part of the form JSON, but is hidden when viewing the form is rendererd.',
    weight: 40,
  },
];

export const formIoCurrentUserEditForm = () =>
  buildCustomComponentEditForm(currentUserDisplayComponents);
