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

import {Components} from 'formiojs';

const TextFieldEditForm = Components.components.textfield.editForm;

const uploaderDisplayComponents = [
  {
    type: 'textfield',
    input: true,
    key: 'label',
    label: 'Label',
    placeholder: 'Label',
    weight: 0,
    validate: {
      required: true,
    },
  },
  {
    type: 'checkbox',
    input: true,
    inputType: 'checkbox',
    key: 'validate.required',
    label: 'Required',
    weight: 10,
    validate: {
      required: false,
    },
  },
  {
    type: 'textfield',
    input: true,
    key: 'key',
    label: 'Property Name',
    placeholder: 'Property Name',
    tooltip: 'The name of this field in the API endpoint.',
    weight: 20,
    validate: {
      required: true,
    },
  },
  {
    type: 'textfield',
    input: true,
    key: 'customOptions.title',
    label: 'Title',
    placeholder: 'Title',
    tooltip: 'Leave empty to use the default title',
    weight: 30,
    validate: {
      required: false,
    },
  },
  {
    type: 'checkbox',
    input: true,
    inputType: 'checkbox',
    key: 'customOptions.hideTitle',
    label: 'Hide title',
    weight: 40,
    validate: {
      required: false,
    },
  },
  {
    type: 'textfield',
    input: true,
    key: 'customOptions.subtitle',
    label: 'Subtitle',
    placeholder: 'Title',
    tooltip: 'Leave empty to hide subtitle',
    weight: 50,
    validate: {
      required: false,
    },
  },
  {
    type: 'number',
    input: true,
    key: 'customOptions.maxFileSize',
    label: 'Maximum file size',
    placeholder: 'Maximum file size',
    defaultValue: 5,
    weight: 60,
    validate: {
      required: true,
    },
  },
  {
    type: 'checkbox',
    input: true,
    inputType: 'checkbox',
    key: 'customOptions.hideMaxFileSize',
    label: 'Hide maximum file size',
    weight: 70,
    validate: {
      required: false,
    },
  },
  {
    type: 'checkbox',
    input: true,
    inputType: 'checkbox',
    key: 'customOptions.camera',
    label: 'Allow camera uploads',
    weight: 80,
    validate: {
      required: false,
    },
  },
];

export const formIoUploaderEditForm = () => {
  const editForm = TextFieldEditForm();
  editForm.components.unshift({key: 'type', type: 'hidden'});

  const tabsComponent = editForm.components.find(component => component.key === 'tabs');
  if (tabsComponent) {
    const displayTab = tabsComponent.components.find(tab => tab.key === 'display');
    if (displayTab) {
      displayTab.components = uploaderDisplayComponents;
    }

    // Keep only the tabs relevant to the custom uploader: the curated Display tab
    // plus the standard Conditional and Logic tabs for configuring visibility/logic.
    tabsComponent.components = tabsComponent.components.filter(tab =>
      ['display', 'conditional', 'logic'].includes(tab.key)
    );
  }

  return editForm;
};
