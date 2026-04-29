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
      tooltip:
        'Document path for the result object (ID + mapped properties). Dot notation, no prefixes. Example: ikoSearchResult or person.ikoResult.',
      validate: {
        required: true,
      },
    },
    {
      type: 'textfield',
      input: true,
      key: 'customOptions.ikoViewKey',
      label: 'IKO Beeld Key',
      placeholder: 'IKO Beeld Key',
      tooltip: 'The IKO aggregate key used to load search actions.',
      validate: {
        required: true,
      },
    },
    {
      type: 'textfield',
      input: true,
      key: 'customOptions.resultListLabel',
      label: 'Result List Label',
      placeholder: 'Selecteer een persoon',
      tooltip:
        'Label shown above the results table after searching. Defaults to: Selecteer een resultaat.',
    },
    {
      type: 'textfield',
      input: true,
      key: 'customOptions.selectedLabel',
      label: 'Selected Item Label',
      placeholder: 'Geselecteerd persoon',
      tooltip:
        'Label shown above the selection box after selecting a result. Defaults to: Geselecteerd resultaat.',
    },
    {
      type: 'textfield',
      input: true,
      key: 'customOptions.openInNewTabLabel',
      label: 'Open in New Tab Button Text',
      placeholder: 'Open persoon in nieuw tabblad',
      tooltip:
        'Text for the open-in-new-tab button. Defaults to: Open in nieuw tabblad. Leave empty to hide.',
    },
    {
      type: 'textfield',
      input: true,
      key: 'customOptions.openInNewTabUrl',
      label: 'Open in New Tab URL',
      placeholder: '/iko/personen/details/{id}',
      tooltip:
        'URL template for the open-in-new-tab button. Use {id} as placeholder for the selected item ID. Leave empty to hide the button.',
    },
    {
      type: 'datagrid',
      input: true,
      key: 'customOptions.propertyMappings',
      label: 'Property Mappings',
      tooltip:
        'Maps table column values to document properties, stored alongside the ID on selection.',
      reorder: false,
      components: [
        {
          type: 'textfield',
          input: true,
          key: 'ikoProperty',
          label: 'Table Column Key',
          placeholder: 'geboortedatum',
          tooltip:
            'Exact column key from the IKO view config, no prefixes. Example: naam, adres.',
        },
        {
          type: 'textfield',
          input: true,
          key: 'propertyName',
          label: 'Document Property Name',
          placeholder: 'geboortedatum',
          tooltip:
            'Property name in the document, relative to the component key. No prefixes. Example: geboortedatum stores at /ikoSearchResult/geboortedatum.',
        },
      ],
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
