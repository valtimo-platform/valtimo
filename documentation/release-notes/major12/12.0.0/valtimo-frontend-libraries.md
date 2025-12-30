# Valtimo frontend libraries

## New Features

The following features were added:

*   **Translation management**

    An administrator can now configure and override translations from a front-end admin page. For more information on how to configure and use this, [refer to this page](../../../features/localization/configuring-localization.md).
*   **Form flow management**

    An administrator can now see, create and edit form flows from a front-end admin page. For more information on form flows, refer to [this page](/broken/pages/IS3fUCisHvoPfR7PEa1o).
*   **Inline edit document definition**

    Document definition can now be edited inline to create a new version.
*   **Pending changes modal extension**

    The pending changes modal has been extended to accept custom modals. An example of this use would be a pending changes modal for an 'Edit mode' function, where you might want to have three buttons (e.g. _Keep editing_, _Save_, _Discard_) instead of the two buttons that are offered out of the box.

    More details about the PendingChangesComponent can be found [here](broken-reference/)
*   **Creating document definitions via the admin interface**

    A document definition can now be created via the admin interface. This is an alternative to creating a document definition in the project, which enables the user to create a document definition without needing to create a file in the project.

    More details about creating document definitions can be found [here](broken-reference/)
*   **Zaken-api plugin action start and end Hersteltermijn**

    A Zaken-API plugin action has been added for both starting and ending a recovery period.

    More information about the plugin actions can be found [here](../../../features/plugins/configure-zaken-api-plugin.md#start-recovery-period).
* **New Zaak type link endpoint** The document Zaaktype link configuration now uses the `/api/management/v1/zgw/zaaktype` endpoint. This new endpoint requires a zaken-api plugin to be configured.
* **Document object type selection is now conditional** When connecting a zaak to the document, the document object type selection is now only shown when using the OPEN\_ZAAK upload-provider.
* **Configurable colors for internal case statuses** When configuring an internal case status, you are provided with a fixed list of colors. This colors are in accordance to the Carbon Design System and will help differentiate between different satuses you might create.
* **Zaken-api plugin action create, update and delete zaakeigenschap** A Zaken-API plugin action has been added for creating, updating and for deleting a zaakeigenschap. More information about the plugin actions can be found [here](../../../features/plugins/configure-zaken-api-plugin.md#create-zaakeigenschap).
* **form-link to process-link** The library `@valtimo/form-link` has been renamed to `@valtimo/process-link`. For information on how to migrate, refer to [this page](migration.md).
*   **Override Form.io options**

    Options used by Form.io in the renderer can now be modified by using the following key in your environment file: `formioOptions`. Refer to [this page](../../../nog-een-plek-geven/reference/environment.md) for more information.
*   **Verzoek plugin JSON mapping**

    The verzoek plugin can now be configured so that the entire verzoek data is copied to a target location. For information on how to configure the verzoek plugin, refer to [this page](../../../features/plugins/configure-verzoek-plugin.md).
*   **Show readable process errors**

    When a user models and deploys an erroneous BPMN process, the user will now get a readable and useful error message.
*   **Documenten API plugin version**

    To determine the available features of the Documenten API, the plugin can now be configured with the version of the Documenten API that is used. This version is also shown on all Case definition management pages that use the Documenten API plugin. For more information on how to configure the verzoek plugin, refer to [this page](../../../features/plugins/configure-documenten-api-plugin.md)
*   **Configurable task list columns**

    A new library has been added - `@valtimo/task-management`. It provides a page where list columns can be configured for tasks of a certain case type. Please follow the migration notes (section 'Task management') on [this page](migration.md).
*   **Rename upload process**

    The auto-deployed upload process `Upload Document` has been renamed to `Documenten API upload document`.
*   **Case migration**

    A new feature has been released to migrate cases from an old version to a new version. This feature is still in beta and should be used with care. For more information on case migration, refer to [this page](../../../features/plugins/configure-documenten-api-plugin.md)
*   **Dark-mode and theme-switching added**

    By implementing the Carbon Design System and making use of the correct color tokens, dark-mode has become a possibility. This feature-toggle is enabled by default. The 3 supported options are Light (default), Dark and System (Changes theme based on the system theme preference). For more information on theming, refer to [this page](../../../nog-een-plek-geven/reference/user-interface/carbon-design-system.md)
*   **Added extra empty-state illustrations**

    6 new empty-state illustrations have been added for added clarification of the empty-state. These are:

    * `assets/img/emptystate-empty.svg`
    * `assets/img/emptystate-error.svg`
    * `assets/img/emptystate-error404.svg`
    * `assets/img/emptystate-no-result.svg`
    * `assets/img/emptystate-not-authorised.svg`
    * `assets/img/emptystate-success.svg`

## Bugfixes

The following bugs were fixed:

*   **Not all case definitions are visible in the menu**

    The left sidebar did not show all case definitions when there were more than 10. Now the left sidebar will show all case definitions.
*   **Not possible to upload more than one file to the case management**

    Uploading a file to the case management worked the first time, the rest of the uploads after that did not update the correct file. Now it is possible to upload more than one file.
*   **Breadcrumbs do not work properly**

    After navigating away from Object page, breadcrumbs did not work properly anymore throughout the application. This issue has been fixed.

## Breaking changes

The following breaking changes were introduced:

*   **ChoiceFieldModule**

    The ChoicefieldModule has been removed. Also the ChoiceFieldService and a few models have been moved to the _@valtimo/components_ library. Instructions on how to migrate to this version of Valtimo can be found [here](migration.md).
*   **`@valtimo/open-zaak`**

    The library `@valtimo/open-zaak` has been removed. EmailExtensionComponent has been removed altogether. The OpenZaakTypeLinkExtension functionality has been moved to `@valtimo/zgw`. Instructions on how to migrate to this version of Valtimo can be found [here](migration.md).
*   **Connector link extension**

    `connectorLinkExtensionInitializer` (exported from `@valtimo/connector-management`) has been removed. For information on how to migrate, [refer to this page](migration.md).
*   **`@valtimo/contact-moment`**

    The library `@valtimo/contact-moment` has been removed. For information on how to migrate, [refer to this page](migration.md).
*   **`@valtimo/customer`**

    The library `@valtimo/customer` has been removed. For information on how to migrate, [refer to this page](migration.md).
*   **Zaakobjecten tab**

    Zaakobjecten has been removed as a default tab. If you want to use this tab in your implementation, [refer to this page](migration.md) on how to migrate.
*   **Form.io Documenten API upload component**

    The Form.io Documenten API upload component has been moved. For information on how to migrate, [refer to this page](migration.md).
*   **`@valtimo/zgw`**

    A new library is included in: `@valtimo/zgw`. All optional ZGW functionality has been moved from other libraries into this optional library. For information on what it includes, and how to migrate, [refer to this page](migration.md).
* **Changes to feature toggle**
  * `enableTabManagement` is now enabled (`true`) by default.
  * `caseListColumn` is now enabled (`true`) by default.
  * `enableObjectManagement` is now enabled (`true`) by default.
  * `caseSearchFields` has been removed. Case search fields are always enabled from now on.
  * `disableFormFlow` has been removed. Form flow is always enabled from now on.
*   **`@valtimo/exact-plugin`**

    The library `@valtimo/exact-plugin` has been removed. For information on how to migrate, [refer to this page](migration.md).

Instructions on how to migrate to this version of Valtimo can be found [here](migration.md).

## Deprecations

The following was deprecated:

*   **ConnectorManagementModule**

    Connector-management has been deprecated and will be replaced by plugins in the future.
*   **Extensions**

    Extensions functionality has been deprecated. For more information, [refer to this page](migration.md).
*   **Open Zaak uploader provider**

    The Open Zaak upload provider has been deprecated. For more information, [refer to this page](migration.md).

## Known issues

This version has the following known issues:

* **Issue1**
  * Discovered in version x.x.x
  * Describe what can be done to work around the issue
* **Issue2**
  * Discovered in version x.x.x
  * Describe what can be done to work around the issue
