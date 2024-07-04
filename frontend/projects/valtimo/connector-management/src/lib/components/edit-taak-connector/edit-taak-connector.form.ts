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

export const editTaakConnectorForm = {
  components: [
    {
      label: 'connectorForm.taak.name',
      tableView: false,
      validate: {
        required: true,
      },
      key: 'connectorName',
      type: 'textfield',
      input: true,
    },
    {
      label: 'connectorForm.taak.openNotificatieConnector.label',
      widget: 'choicesjs',
      tableView: false,
      dataSrc: 'custom',
      data: {
        custom: "values = window['openNotificatieConnectorNames'] || []",
      },
      dataType: 'string',
      clearOnRefresh: true,
      key: 'openNotificatieConnectionName',
      type: 'select',
      input: true,
      validate: {
        required: true,
      },
      placeholder: 'connectorForm.taak.openNotificatieConnector.placeholder',
    },
    {
      label: 'connectorForm.taak.objectsApiConnector.label',
      widget: 'choicesjs',
      tableView: false,
      dataSrc: 'custom',
      data: {
        custom: "values = window['objectApiConnectorNames'] || []",
      },
      dataType: 'string',
      clearOnRefresh: true,
      key: 'objectsApiConnectionName',
      type: 'select',
      input: true,
      validate: {
        required: true,
      },
      placeholder: 'connectorForm.taak.objectsApiConnector.placeholder',
    },
    {
      key: 'submit',
      type: 'button',
      customClass: 'list-inline',
      leftIcon: 'icon mdi mdi-save mt-1',
      input: true,
      label: 'connectorManagement.save',
      tableView: false,
      disableOnInvalid: true,
    },
  ],
};
