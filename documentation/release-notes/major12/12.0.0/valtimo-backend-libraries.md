# Valtimo backend libraries

## New Features

The following features were added:

*   **valtimo-dependency-versions module**

    A new `valtimo-dependency-versions` module has been created, which at the same time removes the version control from `valtimo-dependencies` and `valtimo-gzac-depenencies`.

    This module specifies versions for dependencies of Valtimo.

    More information can be found [here](../../../fundamentals/getting-started/modules/core/valtimo-dependency-versions.md).
*   **User task assignees saved by user ID**

    The assignees of a user task are now saved in the database by their user ID. When implementations use keycloak, the assignee column from the task table in the databases is automatically migrated from email to user ID.
*   **Localization module**

    A new module `localization` has been added, which provides endpoints for user configurable translations. For more information on how to use these translations in the front-end, [refer to this page](../../../features/localization/configuring-localization.md).
* **New endpoint to retrieve Zaaktypen** A new endpoint has been added to the zaken-api module to retrieve zaaktypen: `/api/management/v1/zgw/zaaktype`. This replaces the `/api/v1/openzaak/zaaktype` endpoint from the openzaak module, which is now deprecated. The new endpoint requires at least one Zaken API Plugin to be configured.
* **Moved OpenZaak plugin to new `openzaak-plugin-authentication` module** Since the `openzaak` modules has been deprecated, the `OpenZaakPlugin` has been moved to the new `openzaak-plugin-authentication` module. The packages are still the same to keep it backwards-compatible without configuration migrations.
*   **Value resolver null values**

    Value resolver now supports resolving and handling `null` values. This change can break existing value resolver implementations.

    Migration instructions related to this change can be found [here](migration/).
*   **Plugin actions on all activity types**

    Support for plugin action on all activity types has been added.
*   **Replacement for header based pagination**

    Several endpoints that use URLs in the HTTP headers to paginate results have a new version with endpoints that return the pagination information in the response body. The following endpoints are impacted by this change:

| Old endpoint                                             | New endpoint                                             |
| -------------------------------------------------------- | -------------------------------------------------------- |
| `/api/v1/choice-fields`                                  | `/api/v2/choice-fields`                                  |
| `/api/v1/choice-field-values`                            | `/api/v2/choice-field-values`                            |
| `/api/v1/choice-field-values/{choice_field_name}/values` | `/api/v2/choice-field-values/{choice_field_name}/values` |
| `/api/v1/process/{processDefinitionName}/search`         | `/api/v2/process/{processDefinitionName}/search`         |
| `/api/v1/task`                                           | `/api/v2/task`                                           |

*   **New endpoint to retrieve Zaaktypen**

    A new endpoint has been added to the zaken-api module to retrieve zaaktypen: `/api/management/v1/zgw/zaaktype`. This replaces the `/api/v1/openzaak/zaaktype` endpoint from the openzaak module, which is now deprecated. The new endpoint requires at least one Zaken API Plugin to be configured.
*   **Moved OpenZaak plugin to new `openzaak-plugin-authentication` module**

    Since the `openzaak` modules has been deprecated, the `OpenZaakPlugin` has been moved to the new `openzaak-plugin-authentication` module. The packages are still the same to keep it backwards-compatible without configuration migrations.
*   **Automatically set 'Uiterlijke einddatum afdoening' in Zaken-api**

    The field 'Uiterlijke einddatum afdoening' is now set automatically in the Zaken-api when creating a case in Valtimo.
*   **Internal statuses are now available to cases**

    Cases can be filtered on statuses set to the case via the process. More information on this can be found [here](https://app.gitbook.com/s/bcArISKZtxWk4tKpZb9P/features/case/statuses)
*   **The RabbitMQ outbox publisher now support exchange targets**

    Exchange targets can now be used with the outbox publisher for RabbitMQ by using the `valtimo.outbox.publisher.rabbitmq.exchange` property. More information on this can be found [here](../../../fundamentals/getting-started/modules/core/outbox/outbox-rabbitmq.md)
*   **`Executable` flag is automatically set upon process deployment**

    When deploying processes via the `/api/v1/process/definition/deployment` endpoint or by import, the `executable` flag is automatically set to true. The result is that deployment will no longer fail silently on this misconfiguration. This behaviour is not applied to auto-deployment via classpath.
* **Task list columns can be exported and imported** Columns configured for the task list can now be exported and imported via the case administration.
* **ZGW Document list columns can be exported and imported** Columns configured for the ZGW document list can now be exported and imported via the case administration.

## Bugfixes

The following bugs were fixed:

*   **Error in some plugin action properties**

    The plugin action property would throw an error when the plugin action property was set to a process variable that contained a list.
*   **Plugin auto deployment fails on nullable property**

    If the plugin configuration file contained a 'null' value for a plugin property, an error was thrown.
*   **Access control `in` operator fails on list**

    When a list was provided for the `in` operator (e.g. `["1","2"]`), the permission could not be imported.
*   **Process not linked after deploying a new case definition**

    When a new version of the case definition was deployed, the new case definition would sometimes no longer be linked to any of the process definitions that were linked in previous versions.
*   **Imported forms marked as readonly**

    Imported forms were automatically marked read-only, making it impossible to edit them. The read-only flag is now only applied on auto-deployed forms.

## Breaking changes

The following breaking changes were introduced:

*   **Upgrade to Spring Boot 3**

    Valtimo has been upgraded to Spring Boot 3. This was needed to keep the product up to date with the latest (transitive) dependencies.

    Migration instructions related to this change can be found [here](spring-boot3-migration/).
* **Valtimo dependencies have changed** `valtimo-dependencies` and `valtimo-gzac-depenencies` should no longer be used for `dependencyManagement` or `platform`. This functionality has been replaced by [valtimo-dependency-versions](../../../fundamentals/getting-started/modules/core/valtimo-dependency-versions.md).
* **Moved KvKProvider and BsnProvider** The `KvKProvider` and `BsnProvider` and implementations (`ZaakKvKProvider` and `ZaakBsnProvider`)have been moved to the `zaken-api` module. The [objects-api module](../../../fundamentals/getting-started/modules/zgw/objects-api.md) has been changed to use the relocated interfaces. Please be aware that the new implementations require at least one Zaken API Plugin to be configured.
* **Removed deprecated code** The `form-link` module, which was deprecated in 10.6.0, has been removed. Process links should be used instead. Additionally, `CamundaProcessJsonSchemaDocumentService.getDocument(DelegateExecution execution)` has been removed. This method is replaced by `DocumentDelegateService.getDocument(DelegateExecution execution`.
* **ResourceService implementation is now optional** Valtimo can now start without providing any implementation of the `ResourceService`. When no implementation is provided, the following features will not work:
  * The `camundaSmartDocumentGenerator` and `smartDocumentGenerator` beans will not be available. The plugin should work as normal.
  * The `documentRelatedFileSubmittedEventListenerImpl` bean will not be available.
  * `JsonSchemaDocumentService.assignResource` will throw an error when invoked.
  * The `FormIoFormFileResource` bean will not be available.
* \*\*`OpenZaakUrlProvider` has been replaced The `OpenZaakUrlProvider` class and bean (`openZaakUrlProvider`) have been removed. These have been replaced by:
  * `ZaakUrlProvider`: implemented by `DefaultZaakUrlProvider` in the zaken-api module.
  * `ZaaktypeUrlProvider`: implemented by `DefaultZaaktypeUrlProvider` in the zaken-api module.
* \*\*`ZaakUrlProvider.getZaak(documentId: UUID): String` has been removed. This method is replaced by `ZaakUrlProvider.getZaakUrl(documentId: UUID): URI`.
*   **Removed dependencies from** [**`valtimo-gzac-dependencies`**](../../../fundamentals/getting-started/modules/zgw/valtimo-gzac-dependencies.md)

    The following modules have been removed from [`valtimo-gzac-dependencies`](../../../fundamentals/getting-started/modules/zgw/valtimo-gzac-dependencies.md):

    * [`com.ritense.valtimo:besluit`](../../../fundamentals/getting-started/modules/zgw/besluit.md)
    * [`com.ritense.valtimo:contactmoment`](../../../fundamentals/getting-started/modules/zgw/contactmoment.md)
    * [`com.ritense.valtimo:klant`](../../../fundamentals/getting-started/modules/zgw/klant.md)
    * [`com.ritense.valtimo:objects-api`](../../../fundamentals/getting-started/modules/zgw/objects-api.md)
    * [`com.ritense.valtimo:openzaak-resource`](../../../fundamentals/getting-started/modules/zgw/openzaak-resource.md)
    * [`com.ritense.valtimo:openzaak`](../../../fundamentals/getting-started/modules/zgw/openzaak.md)

    These modules are still defined in the `valtimo-dependency-versions`. Please add them to your project manually if needed.
* **OpenZaak module has been deprecated** Its functionality has been moved or copied to the following modules:
  * [Catalogi API](../../../fundamentals/getting-started/modules/zgw/catalogi-api.md)
  * [Documenten API](../../../fundamentals/getting-started/modules/zgw/documenten-api.md)
  * [OpenZaak Plugin Authentication](../../../fundamentals/getting-started/modules/zgw/openzaak-plugin-authentication.md)
  * [Zaken API](../../../fundamentals/getting-started/modules/zgw/zaken-api.md)

Instructions on how to migrate to this version of Valtimo can be found [here](migration.md).

* **Outdated modules have been deprecated**
  * [Besluit](../../../fundamentals/getting-started/modules/zgw/besluit.md): replaced by [Besluiten API](../../../fundamentals/getting-started/modules/zgw/besluiten-api.md) plugin/module
  * [Contactmoment](../../../fundamentals/getting-started/modules/zgw/contactmoment.md): will be replaced by new plugins in the future
  * External-event: partly replaced by the outbox module. Portal-related functionality has not been replaced.
  * [Haalcentraal BRP](../../../fundamentals/getting-started/modules/zgw/haalcentraal-brp.md): will be replaced by new plugins in the future
  * [Klant](../../../fundamentals/getting-started/modules/zgw/klant.md): will be replaced by new plugins in the future
  * [Openzaak resource](../../../fundamentals/getting-started/modules/zgw/openzaak-resource.md): replaced by the [Documenten API](../../../fundamentals/getting-started/modules/zgw/documenten-api.md) plugin

## Deprecations

The following was deprecated:

*   **Connectors**

    The connector framework, including all connectors, have been deprecated.
*   **Audit module methods**

    Several methods have been deprecated as they were not used for anything. No alternatives are offered. These are:

    * `AuditRecordRepository.findAuditRecordByProperty(String key, Object value, Pageable pageable)`
    * `AuditService.findByEventAndOccurredBetween(Class<? extends AuditEvent> event, LocalDateTime from, LocalDateTime until, Pageable pageable)`
    * `AuditService.findByProperty(String key, Object value, Pageable pageable)`
    * `AuditService.findByEventTypeAndProperty(Class<? extends AuditEvent> event, String key, Object value)`
*   **Audit module classes**

    The `AuditSearchService` class has been deprecated as it was not used for anything.
* **OpenZaak module** The `openzaak` modules has been deprecated and the `OpenZaakPlugin` has been moved to the new `openzaak-plugin-authentication` module. The packages are still the same to keep it backwards-compatible without configuration migrations.

Instructions on how to migrate to this version of Valtimo can be found [here](migration.md).

* **OpenZaak module** The OpenZaak module has been deprecated. The deprecated methods and classes have been annotated with instructions on how to replace them. The general guideline here is to use the available (Plugin) functionality from the ZWG modules as replacement.

## Known issues

This version has the following known issues:

* **Issue1**
  * Discovered in version x.x.x
  * Describe what can be done to work around the issue
* **Issue2**
  * Discovered in version x.x.x
  * Describe what can be done to work around the issue
