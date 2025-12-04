# Valtimo backend libraries (9.18.0)

## New Features

The following features were added:

*   **Custom FormFieldDataResolvers**

    Support was added for creating ExternalFormFieldResolvers that implement a new support(String name) method. Previously, an enum `ExternalFormFieldType` denoted the prefixes that were supported, which prevented implementations from making custom prefixes. Information on how to use form field data resolvers can be found [here](../../../using-valtimo/form-link/using-form-field-data-resolvers.md), and information on how to create custom form field data resolvers can be found [here](../../../extending-valtimo/form-link/custom-form-field-data-resolver.md).
*   **Plugin categories**

    Plugins can now be categorized. This is done by annotating an interface, which plugins can then implement, e.g. `@PluginCategory(key = "category-key-here")`. A plugin that implements more than one interface with a category will belong to both categories.

    This allows for plugins to rely on other plugins. More information on this feature can be found [here](../../../features/plugins/plugins/custom-plugin-definition.md#plugin-categories).
* **Added new ZGW plugins**
  * `openzaak`
    * This plugin allows other plugins to authenticate with openzaak.
  * `documenten-api`
    * This plugin can make a connection to the Documenten API. When a document was generated this plugin is used to upload the document to the Documenten API.
  * `zaken-api`
    * This plugin can make a connection to the Zaken API. This plugin supports the action to link documents that have been uploaded to the Documenten API to the Zaak of the current case.
*   **Improved CamundaProcessJsonSchemaDocumentInstance**

    The `isActive` property of the `CamundaProcessJsonSchemaDocumentInstance` indicates whether the process is still running .

## Bugfixes

The following bugs were fixed:

*   **'No form linked' when a start form has been linked**

    For some cases, it was no longer possible to manually create a new case because of a popup saying that there was no start form configured even though it had been configured. The logs would show a 500 Internal Server Error.

## Breaking changes

* **Changed ExternalDataSubmittedEvent data field type** The `data` field for the `ExternalDataSubmittedEvent` has changed from `Map<ExternalFormFieldType, Map<String, Object>>` to `Map<String, Map<String, Object>>`.

Instructions on how to migrate to this version of Valtimo can be found [here](migration.md).

## Deprecations

The following was deprecated:

*   **FormFieldDataResolver supports method**

    FormFieldDataResolver `supports(ExternalFormFieldType externalFormFieldType)` was deprecated and is replaced with `supports(String externalFormFieldType)`.

Instructions on how to migrate to this version of Valtimo can be found [here](migration.md).

## Known issues

This version has the following known issues:

*   **Multiple existing form associations on process definition**

    When multiple start forms are associated with a single process definition the user is unable to start a new case of that specific type.
* **Updating process variables from a form.io submission**\
  Only process variables of type `String` and `Array<String>` are currently supported by the pv. form.io prefix. Any other types will be set to a null value.
*   **Using formAssociationService.createFormAssociation() on application startup causing the application to crash**

    When form associations are created on application startup using the formAssociationService.createFormAssociation() method, these associations are duplicated. Before the bugfix in this release these duplicated associations were added without errors. After the bugfix in this release the application will throw an exception when creating an already existing association, causing the application to crash on startup.

    **Solution.** The correct way to add form associations is by adding [form link files](../../../using-valtimo/form-link/configure-task.md). Using of formAssociationService.createFormAssociation() should be replaced with form link files.
