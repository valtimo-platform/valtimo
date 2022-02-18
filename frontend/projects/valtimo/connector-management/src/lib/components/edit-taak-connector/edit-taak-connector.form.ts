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
        custom: 'values = window[\'openNotificatieConnectorNames\'] || []',
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
        'connectorForm.taak.openNotificatieConnector.placeholder',
    },
    {
      label: 'connectorForm.taak.objectsApiConnector.label',
      widget: 'choicesjs',
      tableView: false,
      dataSrc: 'custom',
      data: {
        custom: 'values = window[\'objectApiConnectorNames\'] || []',
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
        'connectorForm.taak.objectsApiConnector.placeholder',
    },
    {
      key: 'submit',
      type: 'button',
      customClass: 'list-inline',
      leftIcon: 'icon mdi mdi-save mt-1',
      input: true,
      label: 'connectorManagement.save',
      tableView: false,
      disableOnInvalid: true
    },
  ],
};
