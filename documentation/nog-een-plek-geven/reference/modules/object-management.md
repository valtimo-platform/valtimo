# Object management

## Auto-deployment

Object management configurations can be auto-deployed by creating json files in the `classpath*:config/objectmanagement/` folder. The name of the file does not matter, but it is advised to keep it in line with the object title.

You can find an example of the JSON below:

```json
{
  "id": "c944484a-597a-483f-b647-df3bb5b57f5f",
  "title": "Example",
  "objecttypenApiPluginConfigurationId": "73d181c5-2ead-421c-a5f2-bb7bd455e922",
  "objecttypeId": "0d2d0620-c0f0-43cd-99f8-5156ab15d219",
  "objectenApiPluginConfigurationId": "a13d5023-1a13-4942-9014-33b46104fb5e",
  "showInDataMenu": false,
  "formDefinitionView": "example-view-form",
  "formDefinitionEdit": "example-edit-form"
}
```

`formDefinitionView` and `formDefinitionEdit` specify the names of the forms to use for respectively viewing or editing the object. It is case-insensitive.
