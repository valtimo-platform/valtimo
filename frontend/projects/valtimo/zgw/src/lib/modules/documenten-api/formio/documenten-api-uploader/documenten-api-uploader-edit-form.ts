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

import {Components} from '@formio/js';

const TextfieldEditForm = Components.components.textfield.editForm;

export const documentenApiUploaderEditForm = () => {
  const editForm = TextfieldEditForm();

  const customComponents = [
    {
      type: 'textfield',
      input: true,
      key: 'customOptions.title',
      label: 'Title',
      placeholder: 'Title',
      tooltip: 'Leave empty to use the default title',
      weight: 10,
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
      weight: 11,
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
      weight: 12,
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
      weight: 13,
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
      weight: 14,
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
      weight: 15,
      validate: {
        required: false,
      },
    },
    {
      type: 'checkbox',
      input: true,
      inputType: 'checkbox',
      key: 'disabled',
      label: 'Disabled',
      tooltip: 'Disable the upload field',
      weight: 16,
      validate: {
        required: false,
      },
    },
    {
      type: 'textfield',
      input: true,
      key: 'customOptions.acceptedFiles',
      label: 'Accepted file types (leave blank for no restrictions)',
      placeholder: '.png, .docx, .pdf',
      defaultValue: '',
      weight: 17,
    },
    {
      type: 'checkbox',
      input: true,
      inputType: 'checkbox',
      key: 'customOptions.hideAcceptedFiles',
      label: 'Hide accepted file types',
      weight: 18,
      validate: {
        required: false,
      },
    },
    {
      label: 'HTML',
      tag: 'div',
      content: '<h3>Process variables</h3>',
      refreshOnChange: false,
      type: 'htmlelement',
      input: false,
      tableView: false,
      weight: 19,
    },
    {
      type: 'textfield',
      input: true,
      key: 'customOptions.documentUrlProcessVariable',
      label: 'Document URL',
      tooltip:
        "Specify the process variable name where the Documenten API document URL will be stored. Defaults to 'documentUrl' if left empty.",
      weight: 20,
      validate: {
        required: false,
      },
    },
    {
      label: 'HTML',
      tag: 'div',
      content: '<h3>Documenten API metadata</h3>',
      refreshOnChange: false,
      type: 'htmlelement',
      input: false,
      tableView: false,
      weight: 21,
    },
    {
      label: 'HTML',
      tag: 'div',
      content: '<h4>Filename</h4>',
      refreshOnChange: false,
      type: 'htmlelement',
      input: false,
      tableView: false,
      weight: 22,
    },
    {
      type: 'textfield',
      input: true,
      key: 'customOptions.filename',
      label: 'Default filename',
      tooltip: 'Leave empty to let the user input their own filename',
      weight: 23,
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
      weight: 24,
      validate: {
        required: false,
      },
    },
    {
      type: 'checkbox',
      input: true,
      inputType: 'checkbox',
      key: 'customOptions.hideFilename',
      label: 'Hide filename input',
      weight: 25,
      validate: {
        required: false,
      },
    },
    {
      label: 'HTML',
      tag: 'div',
      content: '<h4>Title</h4>',
      refreshOnChange: false,
      type: 'htmlelement',
      input: false,
      tableView: false,
      weight: 26,
    },
    {
      type: 'textfield',
      input: true,
      key: 'customOptions.documentTitle',
      label: 'Default document title',
      tooltip: 'Leave empty to let the user input their own title',
      weight: 27,
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
      weight: 28,
      validate: {
        required: false,
      },
    },
    {
      type: 'checkbox',
      input: true,
      inputType: 'checkbox',
      key: 'customOptions.hideDocumentTitle',
      label: 'Hide document title input',
      weight: 29,
      validate: {
        required: false,
      },
    },
    {
      label: 'HTML',
      tag: 'div',
      content: '<h4>Author</h4>',
      refreshOnChange: false,
      type: 'htmlelement',
      input: false,
      tableView: false,
      weight: 30,
    },
    {
      type: 'textfield',
      input: true,
      key: 'customOptions.author',
      label: 'Default author',
      tooltip: 'Leave empty to let the user input their own author',
      weight: 31,
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
      weight: 32,
      validate: {
        required: false,
      },
    },
    {
      type: 'checkbox',
      input: true,
      inputType: 'checkbox',
      key: 'customOptions.hideAuthor',
      label: 'Hide author input',
      weight: 33,
      validate: {
        required: false,
      },
    },
    {
      label: 'HTML',
      tag: 'div',
      content: '<h4>Description</h4>',
      refreshOnChange: false,
      type: 'htmlelement',
      input: false,
      tableView: false,
      weight: 34,
    },
    {
      type: 'textfield',
      input: true,
      key: 'customOptions.description',
      label: 'Default description',
      tooltip: 'Leave empty to let the user input their own description',
      weight: 35,
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
      weight: 36,
      validate: {
        required: false,
      },
    },
    {
      type: 'checkbox',
      input: true,
      inputType: 'checkbox',
      key: 'customOptions.hideDescription',
      label: 'Hide description input',
      weight: 37,
      validate: {
        required: false,
      },
    },
    {
      label: 'HTML',
      tag: 'div',
      content: '<h4>Language</h4>',
      refreshOnChange: false,
      type: 'htmlelement',
      input: false,
      tableView: false,
      weight: 38,
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
      weight: 39,
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
      weight: 40,
      validate: {
        required: false,
      },
    },
    {
      type: 'checkbox',
      input: true,
      inputType: 'checkbox',
      key: 'customOptions.hideLanguage',
      label: 'Hide language input',
      weight: 41,
      validate: {
        required: false,
      },
    },
    {
      label: 'HTML',
      tag: 'div',
      content: '<h4>Confidentiality level</h4>',
      refreshOnChange: false,
      type: 'htmlelement',
      input: false,
      tableView: false,
      weight: 42,
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
      weight: 43,
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
      weight: 44,
      validate: {
        required: false,
      },
    },
    {
      type: 'checkbox',
      input: true,
      inputType: 'checkbox',
      key: 'customOptions.hideConfidentialityLevel',
      label: 'Hide confidentiality level input',
      weight: 45,
      validate: {
        required: false,
      },
    },
    {
      label: 'HTML',
      tag: 'div',
      content: '<h4>Creation date</h4>',
      refreshOnChange: false,
      type: 'htmlelement',
      input: false,
      tableView: false,
      weight: 46,
    },
    {
      type: 'checkbox',
      input: true,
      inputType: 'checkbox',
      key: 'customOptions.disableCreationDate',
      label: 'Disable creation date input',
      weight: 47,
      validate: {
        required: false,
      },
    },
    {
      type: 'checkbox',
      input: true,
      inputType: 'checkbox',
      key: 'customOptions.hideCreationDate',
      label: 'Hide creation date input',
      weight: 48,
      validate: {
        required: false,
      },
    },
    {
      label: 'HTML',
      tag: 'div',
      content: '<h4>Informatieobjecttype</h4>',
      refreshOnChange: false,
      type: 'htmlelement',
      input: false,
      tableView: false,
      weight: 49,
    },
    {
      type: 'textfield',
      input: true,
      key: 'customOptions.documentType',
      label: 'Default informatieobjecttype url',
      tooltip:
        "Sometimes referred to as the 'document-type'. Must match the informatieobjecttype url exactly. Leave empty to let the user input their own informatieobjecttype",
      weight: 50,
      validate: {
        required: false,
      },
    },
    {
      type: 'checkbox',
      input: true,
      inputType: 'checkbox',
      key: 'customOptions.disableDocumentType',
      label: 'Disable informatieobjecttype input',
      weight: 51,
      validate: {
        required: false,
      },
    },
    {
      type: 'checkbox',
      input: true,
      inputType: 'checkbox',
      key: 'customOptions.hideDocumentType',
      label: 'Hide informatieobjecttype input',
      weight: 52,
      validate: {
        required: false,
      },
    },
    {
      label: 'HTML',
      tag: 'div',
      content: '<h4>Status</h4>',
      refreshOnChange: false,
      type: 'htmlelement',
      input: false,
      tableView: false,
      weight: 53,
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
      weight: 54,
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
      weight: 55,
      validate: {
        required: false,
      },
    },
    {
      type: 'checkbox',
      input: true,
      inputType: 'checkbox',
      key: 'customOptions.hideStatus',
      label: 'Hide status input',
      weight: 56,
      validate: {
        required: false,
      },
    },
    {
      label: 'HTML',
      tag: 'div',
      content: '<h4>Additional date</h4>',
      refreshOnChange: false,
      type: 'htmlelement',
      input: false,
      tableView: false,
      weight: 57,
    },
    {
      type: 'checkbox',
      input: true,
      inputType: 'checkbox',
      key: 'customOptions.hideAdditionalDate',
      label: 'Hide additional date input',
      weight: 58,
      validate: {
        required: false,
      },
    },
    {
      label: 'HTML',
      tag: 'div',
      content: '<h4>Tags</h4>',
      refreshOnChange: false,
      type: 'htmlelement',
      input: false,
      tableView: false,
      weight: 59,
    },
    {
      type: 'textfield',
      input: true,
      key: 'customOptions.tags',
      label: 'Default tags',
      tooltip: 'A comma separated list of tags. Leave empty to let the user input their own tags',
      weight: 60,
      validate: {
        required: false,
      },
    },
    {
      type: 'checkbox',
      input: true,
      inputType: 'checkbox',
      key: 'customOptions.hideTags',
      label: 'Hide tags input',
      weight: 61,
      validate: {
        required: false,
      },
    },
  ];

  const tabsComponent = editForm.components.find(component => component.key === 'tabs');
  if (tabsComponent) {
    const displayTab = tabsComponent.components.find(tab => tab.key === 'display');
    if (displayTab) {
      displayTab.components.unshift(...customComponents);
    }
  }

  return editForm;
};
