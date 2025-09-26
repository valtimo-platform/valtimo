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

export const editProductAanvragenConnectorForm = {
  display: 'wizard',
  settings: {
    pdf: {
      id: '1ec0f8ee-6685-5d98-a847-26f67b67d6f0',
      src: 'https://files.form.io/pdf/5692b91fd1028f01000407e3/file/1ec0f8ee-6685-5d98-a847-26f67b67d6f0',
    },
  },
  components: [
    {
      title: 'connectorForm.productaanvraag.step0.title',
      breadcrumbClickable: true,
      buttonSettings: {
        previous: true,
        cancel: true,
        next: true,
      },
      navigateOnEnter: false,
      saveOnEnter: false,
      scrollToTop: false,
      collapsible: false,
      key: 'page0',
      type: 'panel',
      label: 'Page 0',
      input: false,
      tableView: false,
      components: [
        {
          label: 'HTML',
          attrs: [
            {
              attr: '',
              value: '',
            },
          ],
          content: 'connectorForm.productaanvraag.step0.tip',
          refreshOnChange: false,
          key: 'html4',
          type: 'htmlelement',
          input: false,
          tableView: false,
        },
        {
          key: 'productAanvraagTypes',
          type: 'editgrid',
          input: true,
          validate: {
            minLength: 1,
          },
          customClass: 'edit-grid-component',
          components: [
            {
              label: 'connectorForm.productaanvraag.step0.typeMapping.productAanvraagType.label',
              tooltip:
                'connectorForm.productaanvraag.step0.typeMapping.productAanvraagType.tooltip',
              tableView: true,
              validate: {
                required: true,
              },
              key: 'productAanvraagType',
              type: 'textfield',
              input: true,
            },
            {
              label: 'connectorForm.productaanvraag.step0.typeMapping.caseDefinitionKey.label',
              widget: 'choicesjs',
              placeholder:
                'connectorForm.productaanvraag.step0.typeMapping.caseDefinitionKey.placeholder',
              tableView: true,
              validate: {
                required: true,
              },
              key: 'caseDefinitionKey',
              type: 'select',
              input: true,
            },
            {
              label: 'connectorForm.productaanvraag.step0.typeMapping.processDefinitionKey.label',
              widget: 'choicesjs',
              tableView: true,
              dataSrc: 'custom',
              data: {
                custom: "values = window['productRequestDefinitions'][row.caseDefinitionKey] || []",
              },
              dataType: 'string',
              refreshOn: 'row.caseDefinitionKey',
              clearOnRefresh: true,
              key: 'processDefinitionKey',
              type: 'select',
              input: true,
              validate: {
                required: true,
              },
              placeholder:
                'connectorForm.productaanvraag.step0.typeMapping.processDefinitionKey.placeholder',
            },
          ],
        },
      ],
    },
    {
      title: 'connectorForm.productaanvraag.step1.title',
      breadcrumbClickable: true,
      buttonSettings: {
        previous: true,
        cancel: true,
        next: true,
      },
      navigateOnEnter: false,
      saveOnEnter: false,
      scrollToTop: false,
      collapsible: false,
      key: 'page1',
      type: 'panel',
      label: 'Page 1',
      input: false,
      tableView: false,
      components: [
        {
          label: 'HTML',
          attrs: [
            {
              attr: '',
              value: '',
            },
          ],
          content: 'connectorForm.productaanvraag.step1.tip',
          refreshOnChange: false,
          key: 'html',
          type: 'htmlelement',
          input: false,
          tableView: false,
        },
        {
          title: 'connectorForm.productaanvraag.step1.connectors.panelTitle',
          collapsible: false,
          key: 'connectorFormProductaanvraagStep1ConnectorsPanelTitle',
          type: 'panel',
          label: 'Panel',
          input: false,
          tableView: false,
          components: [
            {
              label:
                'connectorForm.productaanvraag.step1.connectors.openNotificatieConnector.label',
              widget: 'choicesjs',
              tableView: true,
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
              placeholder:
                'connectorForm.productaanvraag.step1.connectors.openNotificatieConnector.placeholder',
            },
            {
              label: 'connectorForm.productaanvraag.step1.connectors.objectsApiConnector.label',
              widget: 'choicesjs',
              tableView: true,
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
              placeholder:
                'connectorForm.productaanvraag.step1.connectors.objectsApiConnector.placeholder',
            },
          ],
        },
      ],
    },
    {
      title: 'connectorForm.productaanvraag.step2.title',
      breadcrumbClickable: true,
      buttonSettings: {
        previous: true,
        cancel: true,
        next: true,
      },
      navigateOnEnter: false,
      saveOnEnter: false,
      scrollToTop: false,
      collapsible: false,
      key: 'page2',
      type: 'panel',
      label: 'Page 2',
      input: false,
      tableView: false,
      components: [
        {
          label: 'HTML',
          attrs: [
            {
              attr: '',
              value: '',
            },
          ],
          content: 'connectorForm.productaanvraag.step2.tip',
          refreshOnChange: false,
          key: 'html3',
          type: 'htmlelement',
          input: false,
          tableView: false,
        },
        {
          title: 'connectorForm.productaanvraag.step2.applicant.panelTitle',
          collapsible: false,
          key: 'connectorFormProductaanvraagstep2ApplicantPanelTitle',
          type: 'panel',
          label: 'Panel',
          input: false,
          tableView: false,
          components: [
            {
              label: 'HTML',
              attrs: [
                {
                  attr: '',
                  value: '',
                },
              ],
              content: 'connectorForm.productaanvraag.step2.applicant.tip',
              refreshOnChange: false,
              key: 'html5',
              type: 'htmlelement',
              input: false,
              tableView: false,
            },
            {
              label: 'connectorForm.productaanvraag.step2.applicant.roleTypeUrl.label',
              tooltip: 'connectorForm.productaanvraag.step2.applicant.roleTypeUrl.tooltip',
              tableView: true,
              validate: {
                required: true,
              },
              key: 'applicantRoleTypeUrl',
              type: 'textfield',
              input: true,
            },
          ],
        },
      ],
    },
    {
      title: 'connectorForm.productaanvraag.step3.title',
      breadcrumbClickable: true,
      buttonSettings: {
        previous: true,
        cancel: true,
        next: true,
      },
      navigateOnEnter: false,
      saveOnEnter: false,
      scrollToTop: false,
      collapsible: false,
      key: 'page3',
      type: 'panel',
      label: 'Page 3',
      input: false,
      tableView: false,
      components: [
        {
          label: 'HTML',
          attrs: [
            {
              attr: '',
              value: '',
            },
          ],
          content: 'connectorForm.productaanvraag.step3.tip',
          refreshOnChange: false,
          key: 'html6',
          type: 'htmlelement',
          input: false,
          tableView: false,
        },
        {
          label: 'connectorForm.productaanvraag.step3.name',
          tableView: true,
          validate: {
            required: true,
          },
          key: 'connectorName',
          type: 'textfield',
          input: true,
        },
      ],
    },
  ],
};
