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

export const documentenApiUploaderEditForm = () => ({
  components: [
    {key: 'type', type: 'hidden'},
    {
      type: 'textfield',
      input: true,
      key: 'label',
      label: 'Label',
      placeholder: 'Label',
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
      validate: {
        required: false,
      },
    },
    {
      type: 'textfield',
      input: true,
      key: 'customOptions.documentTitle',
      label: 'Default document title',
      tooltip: 'Leave empty to let the user input their own title',
      validate: {
        required: false,
      },
    },
    {
      type: 'checkbox',
      input: true,
      inputType: 'checkbox',
      key: 'customOptions.disableDocumentTitle',
      label: 'Disable document title input',
      validate: {
        required: false,
      },
    },
    {
      type: 'textfield',
      input: true,
      key: 'customOptions.filename',
      label: 'Default filename',
      tooltip: 'Leave empty to let the user input their own filename',
      validate: {
        required: false,
      },
    },
    {
      type: 'checkbox',
      input: true,
      inputType: 'checkbox',
      key: 'customOptions.disableFilename',
      label: 'Disable filename input',
      validate: {
        required: false,
      },
    },
    {
      type: 'textfield',
      input: true,
      key: 'customOptions.author',
      label: 'Default author',
      tooltip: 'Leave empty to let the user input their own author',
      validate: {
        required: false,
      },
    },
    {
      type: 'checkbox',
      input: true,
      inputType: 'checkbox',
      key: 'customOptions.disableAuthor',
      label: 'Disable author input',
      validate: {
        required: false,
      },
    },
    {
      type: 'select',
      label: 'Default status',
      key: 'customOptions.status',
      placeholder: 'Select a default status',
      data: {
        values: [
          {value: 'in_bewerking', label: 'In editing'},
          {value: 'ter_vaststelling', label: 'To be confirmed'},
          {value: 'definitief', label: 'Definitive'},
          {value: 'gearchiveerd', label: 'Archived'},
        ],
      },
      dataSrc: 'values',
      input: true,
      validate: {
        required: false,
      },
    },
    {
      type: 'checkbox',
      input: true,
      inputType: 'checkbox',
      key: 'customOptions.disableStatus',
      label: 'Disable status input',
      validate: {
        required: false,
      },
    },
    {
      type: 'select',
      label: 'Default language',
      key: 'customOptions.language',
      placeholder: 'Select a default language',
      data: {
        values: [
          {value: 'nld', label: 'Dutch'},
          {value: 'eng', label: 'English'},
          {value: 'deu', label: 'German'},
        ],
      },
      dataSrc: 'values',
      input: true,
      validate: {
        required: false,
      },
    },
    {
      type: 'checkbox',
      input: true,
      inputType: 'checkbox',
      key: 'customOptions.disableLanguage',
      label: 'Disable language input',
      validate: {
        required: false,
      },
    },
    {
      type: 'textfield',
      input: true,
      key: 'customOptions.documentType',
      label: 'Default document type url',
      tooltip:
        'Must match the document type url exactly. Leave empty to let the user input their own document type',
      validate: {
        required: false,
      },
    },
    {
      type: 'checkbox',
      input: true,
      inputType: 'checkbox',
      key: 'customOptions.disableDocumentType',
      label: 'Disable document type input',
      validate: {
        required: false,
      },
    },
    {
      type: 'textfield',
      input: true,
      key: 'customOptions.description',
      label: 'Default description',
      tooltip: 'Leave empty to let the user input their own description',
      validate: {
        required: false,
      },
    },
    {
      type: 'checkbox',
      input: true,
      inputType: 'checkbox',
      key: 'customOptions.disableDescription',
      label: 'Disable description input',
      validate: {
        required: false,
      },
    },
    {
      type: 'select',
      label: 'Default confidentiality level',
      key: 'customOptions.confidentialityLevel',
      placeholder: 'Select a default confidentiality level',
      data: {
        values: [
          {value: 'openbaar', label: 'Public'},
          {value: 'beperkt_openbaar', label: 'Restricted public'},
          {value: 'intern', label: 'Internal'},
          {value: 'zaakvertrouwelijk', label: 'Case confidential'},
          {value: 'vertrouwelijk', label: 'Private'},
          {value: 'confidentieel', label: 'Confidential'},
          {value: 'geheim', label: 'Secret'},
          {value: 'zeer_geheim', label: 'Very secret'},
        ],
      },
      dataSrc: 'values',
      input: true,
      validate: {
        required: false,
      },
    },
    {
      type: 'checkbox',
      input: true,
      inputType: 'checkbox',
      key: 'customOptions.disableConfidentialityLevel',
      label: 'Disable confidentiality level input',
      validate: {
        required: false,
      },
    },
  ],
});
