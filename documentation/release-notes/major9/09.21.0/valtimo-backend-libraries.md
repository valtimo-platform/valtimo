# Valtimo backend libraries (9.21.0)

## New Features

The following features were added:

*   **Improved CamundaProcessJsonSchemaDocumentInstance**

    The `isActive` property of the `CamundaProcessJsonSchemaDocumentInstance` indicates whether the process is still running.
*   **System processes**

    Processes can now be marked as a system process. System processes are processes that are critical to the functioning of Valtimo itself. More information about this feature can be found [here](../../../features/process/systemprocesses.md).

## Bugfixes

* Process variables of type `Boolean` and `Number` submitted via form-io using the pv. prefix were incorrectly parsed as text values thereby replacing the initially submitted value with `null`.

## Breaking changes

No breaking changes

## Deprecations

The following was deprecated:

*   **FormFieldDataResolver `get` method**

    The method `get(String documentDefinitionName, UUID documentId, String... varNames)` was deprecated and\
    is replaced with `get(DataResolvingContext dataResolvingContext, String... varNames)`.

Instructions on how to migrate to this version of Valtimo can be found [here](migration.md).

## Known issues

This version has the following known issues:

*   **Multiple existing form associations on process definition**

    When multiple start forms are associated with a single process definition the user is unable to start a new case of that specific type.
* **Updating process variables from a form.io submission**\
  Only process variables of type `String`, `Number`, `Boolean` and `Array<String>` are currently supported by the pv. form.io prefix. Any other types will be set to a `null` value.
* **Form flow definition does not read `nextStep` property**
  * Discovered in version 9.19.0
  * Instead of using `nextStep`, `nextSteps` can be used.
