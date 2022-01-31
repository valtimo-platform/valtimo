export const formIoUploaderEditForm = () => ({
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
  ],
});
