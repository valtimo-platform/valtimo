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

export const objectManagementSelectEditForm = () => ({
  components: [
    {type: 'hidden', key: 'type'},
    {
      type: 'tabs',
      key: 'tabs',
      components: [
        {
          label: 'Display',
          key: 'display',
          weight: 0,
          components: [
            {
              type: 'textfield',
              key: 'label',
              label: 'Label',
              input: true,
              validate: {required: true},
            },
            {
              type: 'textfield',
              key: 'key',
              label: 'Property Name',
              input: true,
              validate: {required: true},
            },
          ],
        },
        {
          label: 'Data',
          key: 'data',
          weight: 10,
          components: [
            {
              type: 'radio',
              key: 'customOptions.identifierType',
              label: 'Identify Configuration By',
              input: true,
              inline: true,
              defaultValue: 'title',
              values: [
                {value: 'title', label: 'Title'},
                {value: 'id', label: 'ID'},
              ],
            },
            {
              type: 'textfield',
              key: 'customOptions.objectManagementId',
              label: 'Object Management Configuration ID',
              input: true,
              tooltip: 'UUID of the Object Management configuration.',
              customConditional: "show = data.customOptions?.identifierType === 'id'",
            },
            {
              type: 'textfield',
              key: 'customOptions.objectManagementTitle',
              label: 'Object Management Configuration Title',
              input: true,
              tooltip: 'Title of the Object Management configuration.',
              customConditional:
                "show = !data.customOptions?.identifierType || data.customOptions?.identifierType === 'title'",
            },
            {
              type: 'number',
              key: 'customOptions.pageSize',
              label: 'Page Size',
              input: true,
              defaultValue: 20,
              tooltip: 'Number of items per page',
            },
            {
              type: 'select',
              key: 'customOptions.valueFormat',
              label: 'Value Format',
              input: true,
              defaultValue: 'id',
              data: {
                values: [
                  {value: 'id', label: 'ID Only'},
                  {value: 'full', label: 'Full Object'},
                  {value: 'columns', label: 'Column Values'},
                ],
              },
              tooltip: 'What data to store in the form value',
            },
          ],
        },
        {
          label: 'Columns',
          key: 'columns',
          weight: 20,
          components: [
            {
              type: 'editgrid',
              key: 'customOptions.columns',
              label: 'Column Configuration',
              input: true,
              reorder: false,
              inlineEdit: false,
              rowDrafts: false,
              addAnother: 'Add Column',
              saveRow: 'Save',
              removeRow: 'Remove',
              templates: {
                header:
                  '<div class="row"><div class="col-sm-4"><strong>Label</strong></div>' +
                  '<div class="col-sm-4"><strong>Object Path</strong></div>' +
                  '<div class="col-sm-2"><strong>Options</strong></div>' +
                  '<div class="col-sm-2"></div></div>',
                row:
                  '<div class="row">' +
                  '<div class="col-sm-4">{{ row.label || "(no label)" }}</div>' +
                  '<div class="col-sm-4"><code>{{ row.path || "—" }}</code></div>' +
                  '<div class="col-sm-2">' +
                  '{% if (row.filterable) { %}<span class="cds--tag cds--tag--cyan">search</span> {% } %}' +
                  '{% if (row.sortable) { %}<span class="cds--tag cds--tag--teal">sort</span>{% } %}' +
                  '</div>' +
                  '<div class="col-sm-2"><div class="btn-group pull-right">' +
                  '<button class="btn btn-sm btn-light editRow"><i class="fa fa-edit"></i></button> ' +
                  '<button class="btn btn-sm btn-light removeRow"><i class="fa fa-times"></i></button>' +
                  '</div></div>' +
                  '</div>',
                footer: '',
              },
              components: [
                {
                  type: 'textfield',
                  key: 'path',
                  label: 'Object Path',
                  input: true,
                  tooltip:
                    'Path to the value in the object. e.g., record.data.name, record.startAt, uuid.',
                  validate: {required: true},
                },
                {
                  type: 'textfield',
                  key: 'label',
                  label: 'Label',
                  input: true,
                  tooltip: 'Column header. Supports translation keys (e.g. columns.name).',
                },
                {
                  type: 'select',
                  key: 'viewType',
                  label: 'Display Type',
                  input: true,
                  defaultValue: 'text',
                  data: {
                    values: [
                      {value: 'text', label: 'Text'},
                      {value: 'date', label: 'Date'},
                      {value: 'boolean', label: 'Boolean'},
                    ],
                  },
                },
                {
                  type: 'checkbox',
                  key: 'sortable',
                  label: 'Sortable',
                  input: true,
                  tooltip: 'Only supported for record.* paths.',
                  customConditional: "show = row.path && row.path.startsWith('record.')",
                },
                {
                  type: 'select',
                  key: 'defaultSortDirection',
                  label: 'Default Sort',
                  input: true,
                  defaultValue: 'none',
                  tooltip: 'Initial sort direction when component loads.',
                  customConditional: 'show = row.sortable === true',
                  data: {
                    values: [
                      {value: 'none', label: 'None'},
                      {value: 'desc', label: 'Descending (newest/highest first)'},
                      {value: 'asc', label: 'Ascending (oldest/lowest first)'},
                    ],
                  },
                },
                {
                  type: 'checkbox',
                  key: 'filterable',
                  label: 'Searchable',
                  input: true,
                  tooltip: 'Only supported for record.data.* paths.',
                  customConditional: "show = row.path && row.path.startsWith('record.data.')",
                },
                {
                  type: 'select',
                  key: 'filterType',
                  label: 'Search Type',
                  input: true,
                  defaultValue: 'icontains',
                  customConditional: 'show = row.filterable === true',
                  data: {
                    custom:
                      "values = row.inputType === 'dateRange' " +
                      "? [{value:'range',label:'Range'},{value:'gte',label:'Start Date Only'},{value:'lte',label:'End Date Only'}] " +
                      ": [{value:'exact',label:'Exact Match'},{value:'icontains',label:'Contains (case-insensitive)'},{value:'gte',label:'Greater/Equal'},{value:'lte',label:'Less/Equal'}]",
                  },
                },
                {
                  type: 'select',
                  key: 'inputType',
                  label: 'Search Field Type',
                  input: true,
                  defaultValue: 'text',
                  customConditional: 'show = row.filterable === true',
                  data: {
                    values: [
                      {value: 'text', label: 'Text Field'},
                      {value: 'dropdown', label: 'Dropdown'},
                      {value: 'date', label: 'Date Picker'},
                      {value: 'dateRange', label: 'Date Range'},
                    ],
                  },
                },
                {
                  type: 'textfield',
                  key: 'dropdownOptionsJson',
                  label: 'Search Dropdown Options (JSON)',
                  input: true,
                  placeholder: '[{"value":"URGENT","label":"Urgent"}]',
                  tooltip: 'JSON array of options with value and label properties.',
                  customConditional:
                    "show = row.filterable === true && row.inputType === 'dropdown'",
                },
              ],
            },
          ],
        },
        {
          label: 'Validation',
          key: 'validation',
          weight: 30,
          components: [
            {
              type: 'checkbox',
              key: 'validate.required',
              label: 'Required',
              input: true,
              tooltip: 'Field must have at least 1 selection',
            },
            {
              type: 'number',
              key: 'validate.minLength',
              label: 'Minimum Selections',
              input: true,
              tooltip: 'Minimum required selections',
            },
            {
              type: 'number',
              key: 'validate.maxLength',
              label: 'Maximum Selections',
              input: true,
              tooltip: 'Maximum selections allowed. Add button disabled when reached.',
            },
            {
              type: 'textfield',
              key: 'errors.custom',
              label: 'Selection Error Message',
              input: true,
              placeholder: 'e.g. "Select between 2 and 5 items"',
              tooltip: 'Error message shown when min/max selection requirements are not met.',
            },
          ],
        },
      ],
    },
  ],
});
