# Valtimo backend libraries (9.20.0)

## New Features

The following features were added:

*   **Additional method for finding documents from within a process**

    The `search` method in the `JsonSchemaDocumentSearchService` does not work when retrieving a document if no authorization is found. A new method, `searchWithoutAuthorization` is now available. For classes that implement the `DocumentSearchService`, this method has a default and only needs to be implemented if this use case is necessary.
*   **Zaakobjecten can now be edited**

    When creating a form that includes a propertyName with "zaakobject:objecttype:path/to/variable" it will now be prefilled when loading the form. When submitting the form the corresponding zaakobject is updated with the new values

    The uploading is handled by a new `ExternalDataSubmittedEvent` handler called `ZaakObjectListener`
*   **KeyCloak**

    KeyCloak libraries have been updated to 19.0.1. Older KeyCloak server versions are still supported.

## Bugfixes

No bugfixes.

## Breaking changes

* **Added extra parameter to KeycloakService** The `KeycloakService` constructor now requires an additional parameter called `keycloakClientName`.

Instructions on how to migrate to this version of Valtimo can be found [here](migration.md).

## Deprecations

No new deprecations.

## Known issues

This version has the following known issues:

*   **Multiple existing form associations on process definition**

    When multiple start forms are associated with a single process definition the user is unable to start a new case of that specific type.
* **Updating process variables from a form.io submission**\
  Only process variables of type `String` and `Array<String>` are currently supported by the pv. form.io prefix. Any other types will be set to a null value.
* **Form flow definition does not read `nextStep` property**
  * Discovered in version 9.19.0
  * Instead of using `nextStep`, `nextSteps` can be used.
