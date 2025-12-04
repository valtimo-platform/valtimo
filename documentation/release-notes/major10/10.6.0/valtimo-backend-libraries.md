# Valtimo backend libraries

## New Features

The following features were added:

*   **New plugin action to set the zaak status**

    The Zaken Api plugin has a new plugin action to set the zaak status.
*   **New plugin action to create a 'Zaakresultaat'**

    The Zaken Api plugin has a new plugin action to create a 'Zaakresultaat'.
*   **New plugin action to create a 'Zaakbesluit'**

    The Besluiten Api plugin has a new plugin action to create a 'Zaakbesluit'.
*   **New plugin action to link a Document to a Besluit**

    The Besluiten Api plugin has a new plugin action to link a Document to a Besluit.
*   **Job service**

    A process bean to manipulate Camunda jobs. For now, only manipulation of timer event dates is supported. This is useful when a timer has to be changed after it has already started. For more information, see [here](../../../features/process/job-service.md).
*   **API responses now include charsets**

    All Valtimo API responses now include a character set in the Content-Type header. The character set has been set to UTF-8.
*   **New API endpoint to retrieve prefilled forms**

    A new API endpoint has been added to retrieve prefilled forms that are configured in the Process-Links menu:

    `GET /v2/process-link/task/{taskId}`
*   **Extended process link API endpoints**

    All API endpoints below have been extended. They used to only work with plugins. Now hey now also work with Forms and Form-flows.

    `GET /api/v1/process-link`

    `POST /api/v1/process-link`

    `PUT /api/v1/process-link`

    `DELETE /api/v1/process-link/{processLinkId}`
*   **Updated dependency versions**

    Many dependencies have been updated. A few of the dependency updates:

    * `org.camunda.bpm:camunda-engine` has been updated to version 7.19.0
    * `org.liquibase:liquibase-core` has been updated to version 4.21.1
    * `org.yaml:snakeyaml` has been updated to version 2.0
    * `org.keycloak:keycloak-admin-client` has been updated to version 21.1.0

    Versions of other dependencies can be found [here](https://github.com/valtimo-platform/valtimo-backend-libraries/blob/10.6.0.RELEASE/gradle.properties).
*   **Process links configuration autodeployment**

    Process links can now be created by adding a configuration file in Valtimo. This configuration file is automatically used when rebooting Valtimo. This release adds support for the autodeployment of process links of type form, form-flow, and plugin action. More information [here](/broken/pages/mWaYYy8bFNDCFZdqctW8#configuration-by-autodeployment)

    * **Plugin configuration auto deployment**

    Plugin configurations can now be created by adding a configuration file in Valtimo. More information [here](/broken/pages/XBCS6qGsbPa0S6ojnYjs)
*   **New REST API endpoints have been added**

    A new endpoint has been added to return a prefilled Form IO form that was configured on a start-event of a BPMN:

    `GET /api/v1/process-definition/{process-definition-id}/start-form`

    A new endpoint has been added to return a prefilled Form IO form that was configured on a user-task of a BPMN:

    `GET /api/v2/process-link/task/{taskId}`

    A new endpoint has been added to return a list of process-link-types with a single property 'enabled'. The property ' enabled' is true when the process-link-type is enabled for the specified activity-type:

    `GET /api/v1/process-link/types?activityType={activityType}`

    A new endpoint has been added for submitting form when the form was initiated using a processlink:

    `POST /api/v1/process-link/{processLinkId}/form/submission`

    Two new endpoints have been added for retrieving and updating user configuration:

    `GET /api/v1/user/settings` `PUT /api/v1/user/settings`
* **Prefilling of start forms for supporting processes** Start forms configured for supporting processes are now prefilled with case data when opened.
* **Support for form flows to start cases and supporting processes** Form flows can now be used to start a new case or supporting processes for an existing case. More information [here](/broken/pages/gfMF9k7Wj1jYJeTeiKq5#starting-a-new-case-and-saving-submission-data-to-defined-location)

## Bugfixes

The following bugs were fixed:

*   **Reuse user var instead of retrieving it again**

    In the document service when creating a case `var user` was not re-used instead `SecurityUtils.getCurrentUserLogin())` was used again leading to having a possible different username when creating a case or attaching documents.
*   **Reorder object columns**

    Fixed changing the ordering of list-columns and search-fields.
*   **Not all uses shown in candidate users dropdown**

    The dropdown list with candidate users on a case page, now shows all users. There was a bug that cases the API endpoint to not respond with all users when there were more than 200 Keycloak users.
*   **Maximum of 20 SmartDocument placeholders**

    The maximum number of 20 SmartDocument placeholders has been removed. It is now possible to enter many more placeholders. The maximum has been removed for all multi-input components within Valtimo. Which means that the maximum has also been removed for other features, such as the Verzoeken plugin mapping.
*   **Object management list column date format**

    The list columns of Object API objects now displays dates with the configured date format.
*   **Objecten API search bugfixes**

    Several bugs have been fixed for the Objecten API search:

    * The search now properly searches through nested properties using a different path notation.
    * It is now possible to search for properties with data type 'boolean'.
    * It is now possible to search for properties with data type 'date'.
    * It is now possible to search for properties with data type 'datetime'.
*   **Configurable directory for temporary files**

    It's now possible to configure a directory that can be used for temporary files with the new property: `valtimo.resource.temp.directory`. This property can be used to make Valtimo multi instance ready. More information [here](../../../running-valtimo/application-configuration/multi-instance-ready.md).
*   **Plugin configuration validation**

    It is now possible to add `javax.validation.constraints` on plugin properties. Some plugins are now validated:

    * The `URL` property must now be a valid url in the following plugins:
      * Besluiten API Plugin
      * Catalogi API Plugin
      * Notificaties API Plugin
      * Objecten API Plugin
      * Objecttypen API Plugin
      * SmartDocuments Plugin
      * Zaken API Plugin
    * The Documenten API Plugin property `Bronorganisatie` must now have a length of 9.
    * The Notificaties API Plugin property `Callback URL` must now be a valid url.
    * The Object Token Authentication Plugin property `Token` now has a minimum length of 20.
* **Attempts to double decrypt plugin secret**

When deploying a plugin configuration file, Valtimo would try to decrypt plugin secrets twice. This would often result in errors. Valtimo will now only decrypt the plugin secrets once.

## Breaking changes

The following breaking changes were introduced:

*   **Object search path**

    The path -field that is used for searching for objects, has changed. It now uses the following notation:

    `obj:/customer/name`

    There is no need to manually change the path. Applications that upgrade to 10.6.0 are automatically migrated.
* **Renamed some classes in favor of Process links:**
  * ProcessLinkTaskProvider.java → FormLinkTaskProvider.java
  * FormProcessLinkTaskProvider.java → FormFormLinkTaskProvider.java
  * PluginProcessLinkResource → ProcessLinkResource
  * CopyPluginActionsOnProcessDeploymentListener → CopyPluginLinkOnProcessDeploymentListener
* **Other changes in favor of Process links:**
  * `ProcessLinkResource` bean name has changed to `formProcessLinkResource`
  * `ProcessLinkService` bean name has changed to `formProcessLinkService`
  * `PluginProcessLink.id` is now of type `UUID`
  * `PluginProcessLink.activityType` is now of type `ActivityTypeWithEventName`
  * `PluginProcessLinkCreateDto.activityType` is now of type `ActivityTypeWithEventName`
  * `PluginProcessLinkResultDto` has a new mandatory constructor property `activityType`
  * `PluginProcessLinkResultDto.activityType` is now of type `ActivityTypeWithEventName`
  * `PluginProcessLinkRepository` no longer extends `JpaRepository`

## Deprecations

No deprecations.

## Known issues

No known issues.
