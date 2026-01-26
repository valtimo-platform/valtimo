# 13.8.0

{% hint style="info" %}
**Release date 17-12-2025**
{% endhint %}

## New Features

* **Setting case properties from within a form**

You can now update a limited set of `case:` properties directly from a Form.io form by using the **Form.io Custom
Property** `targetKey`. The supported `targetKey` values:

- `case:assigneeId` — updates the case assignee
- `case:internalStatus` — updates the case internal status
- `case:caseTags` — adds a tag to the case

Only the keys listed above are supported. Setting `targetKey` to any other `case:` property is **not supported** and
will still result in an error.

- **Custom component widgets support for key/value inputs**

Custom Key/Value pairs can be configured in the custom component widgets. These properties are then made accessible inside of the component.
More details can be found [here](../../../features/case/case-detail/tabs/widgets.md)

- **Zaken API: Case note synchronization to the Zaak linked to the Case**

You can now enable the synchronization of Case notes to the linked Zaak in the Zaken API plugin configuration. 
This is a global setting, and when enabled creates, updates and deletes ZaakNotitie for each Case note after the synchronization is enabled. 
Case notes already existing before synchronization was enabled are ignored.
More details can be found [here](../../../features/plugins/configure-zaken-api-plugin.md)

- **Zaken API: New plugin actions `Create Zaaknotitie` and `Patch Zaaknotitie`**

Plugins actions `Create Zaaknotitie` and `Patch Zaaknotitie` are available in the Zaken API plugin. 
More details can be found [here](../../../features/plugins/configure-zaken-api-plugin.md)

## Enhancements

* **The options for the Documenttype drop-down in the Documenten API metadata modal is now alphabetically ordered and searchable.**

  When you try to upload a file to the Documenten API, you are shown a modal where you can enter metadata about the file you want to upload.
  Within this modal there is a drop-down labelled "Documenttype". The options within this drop-down are now ordered alphabetically and you can search through the list to select the appropriate documenttype. (As you can already do for the "Vertrouwelijkheidsaanduiding" and "Status" fields.)

## Bugfixes

* Resolved issue where during deployment of process-links the wrong process version is looked up.
* Resolved issue where the translations in the plugin action 'Get Resultaattypen' configuration page of plugin 'Catalogi API' were not displayed correctly.
* Resolved issue where saving a case header widget configuration was not possible due to the save button being disabled.
