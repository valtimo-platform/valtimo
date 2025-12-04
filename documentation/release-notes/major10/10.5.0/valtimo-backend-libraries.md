# Valtimo backend libraries

## New Features

The following features were added:

*   **Changed Portaaltaak 'create-portaaltaak' action properties**

    The plugin action properties of the 'create-portaaltaak' action have been changed: from the optional 'bsn' and 'kvk' properties to a generic 'key' and 'value'. These properties can be configured when the Portaaltaak is not intended for the initiator of the Zaak.
*   **ObjectenApiClient now supports 'host.docker.internal' objecttypes**

    The ObjectenApiClient now changes objectype-urls from 'host.docker.internal' to 'localhost' and vise versa where needed.
*   **Added Correlation Service ProcessBean**

    This process bean allows exposes methods that provide message correlation and association to a document which can be used in message throw events as an expression. More detail [here](../../../features/process/correlation-service.md).
*   **Portaaltaak process name change**

    The name for the Portaaltaak system process, which should run when a portaaltaak has been completed, has been changed to `Process completed Portaaltaak`.
*   **New plugin action in the Documenten API to download documents**

    This new plugin action downloads a document from the Documenten API and stores it in a temporary file. More information on this plugin action can be found [here](../../../features/plugins/configure-documenten-api-plugin.md#download-document).
*   **New API endpoints to retrieve types from the Catalog API**

    New API endpoints have been added to retrieve several types from the Catalogi API. The following types can be retrieved:

    * Statustype
    * Resultaattype
    * Besluittype

    The Catalogi API plugin must be configured in order to use the new API endpoints.
*   **Renamed Portaaltaak plugin property**

    The 'uploadedDocumentsHandlerProcess' plugin property has been renamed to 'completeTaakProcess'. This property indicates which process is started to process uploaded files and to complete the Camunda task. Existing plugin configurations are migrated automatically.
* **DocumentVariableDelegate improvements**
  * `findValueByJsonPointerOrDefault(jsonPointer, execution, defaultValue)` has been added. This allows a default value to be returned if no value is found.
  * Value transformation now supports arrays and objects.

## Bugfixes

The following bugs were fixed:

*   **Duplicate results when retrieving process instance variables**

    Retrieving process instance variables via the `/v1/process-instance/{id}/variables` endpoint or the underlying `getProcessInstanceVariables` method in `CamundaProcessService` would fail if there were multiple variables found with the same key.
*   **Duplicate file uploads due to form prefill**

    When a file-upload user task was executed multiple times within the same process instance, the subsequent execution would prefill the form with previously uploaded files. This caused the file to be duplicated on the case if the prefilled file was not removed from the list by the user.

    The prefill of a form input can now be disabled by using the `prefill` property. More information can be found [here](../../../features/forms/creating-forms-in-valtimo.md#disabling-prefill)
* **Remove correlation with no business key**
  * Removed methods that allowed sending messages without business key.
  * Changed methods with business key as optional to required
*   **DocumentVariableDelegate array value transformation**

    Values of an array were deserialized into objects of type JsonNode, which cannot be used by JUEL. They are now deserialized into types that can be used properly.
*   **Mapping to new arrays on Form submission**

    When mapping values of a form submission into a missing array, this resulted in an error. It will now add the array and values instead.
* **Not all users shown in candidate users dropdown** The dropdown list with candidate users on a case page, now shows all users. There was a bug that caused the API endpoint to not respond with all users when there were more than 200 Keycloak users.

## Breaking changes

The following breaking changes were introduced:

*   **Deleted process 'Retrieve Document and link to Zaak'**

    The BPMN process 'Retrieve Document and link to Zaak' was deleted. However, applications might still have the processes available in the process list. If so, any process links must be moved to the process 'process-portaaltaak-uploaded-documents'.

Instructions on how to migrate to this version of Valtimo can be found [here](migration.md).

## Deprecations

No deprecations.

## Known issues

No known issues.
