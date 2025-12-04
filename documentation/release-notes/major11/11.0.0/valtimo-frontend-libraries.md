# Valtimo frontend libraries

## New Features

The following features were added:

*   **Angular and dependency upgrades**

    Angular has been upgraded from version 14 to 16. In addition, various dependencies have been upgraded with their versions now locked. Please refer to the [migration guide](migration.md) for instructions on how to upgrade your implementation to be compatible with this version of the front-end libraries.
*   **Policy Based Access Control**

    Implemented PBAC frontend integration for the following features:

    * Creating a Case
    * Assigning an user to a Case
    * Claiming a Case
    * Adding a Case Note
    * Editing a Case Note
    * Deleting a Case Note

    For more information on how to use access control in the front-end, refer to [this page](../../../features/access-control/for-developers/frontend-access-control.md).
*   **Migration of old design components**

    The library `@valtimo/user-interface` has been removed. All of its components have been moved to `@valtimo/components`. In order order to migrate, please refer to the [migration guide](migration.md). The design of the form components previously included in `@valtimo/user-interface` has been migrated to the Carbon design system.
*   **Placeholders for plugin configuration fields**

    Placeholders are added for plugin configuration fields, so it's more clear what formats are expected for urls.
*   **v-input component extended**

    The `v-input` component has been extended with a placeholder input.
*   **Carbon List**

    A new component `valtimo-carbon-list` has been added. This component is backwards compatible with the `valtimo-list`, making it easier to transition to the new Carbon look and feel. A guide on how to replace the `valtimo-list` with the `valtimo-carbon-list` can be found in the [migration guide](migration.md).

    For a full view on the new list check the [CarbonListComponent reference](../../../nog-een-plek-geven/reference/user-interface/valtimo-carbon-list.md)
*   **Task List**

    Task List has been updated to the Carbon Design System and is now using the CarbonListComponent.
*   **Case List**

    Case List has been updated to the Carbon Design System and is now using the CarbonListComponent.
*   **Bulk assign cases**

    Implemented the bulk assign functionality within the Case List.
*   **S3 Upload update**

    Added _documentId_ to the request body of the S3 Resource(this is not used by the default Valtimo backend)
*   **Disable submenu items**

    Added _restriction_ based on user roles to the submenu items to be able to disable them. An implementation can now specify required roles in submenu items by adding _roles_ attribute to menu item children.
*   **Abstract \_refreshDocument$**

    Moved _\_refreshDocument$_ from DossierDetailComponent to DossierService and added its corresponding methods for correct behaviour. An implementation can now use the refresh method on DossierService to refresh the document on the case detail page from implementation code.
*   **Task form loading text**

    When a task is opened, it will first show a loading text while the form is loading.

## Bugfixes

*   **Forms upload and download**

    The form upload now works again with newly downloaded forms. When downloading a form, it will now only download the Form IO content without metadata fields.
*   **Sequence numbers not showing**

    Fixed an issue where sequence numbers were not showing on the case list when an environment case list configuration is used.
*   **Fixed broken Carbon select box**

    After navigating away from the form admin detail page, Carbon components using overlays did not work anymore throughout the application. This issue has been fixed.

## Breaking changes

The following breaking changes were introduced:

* **Removed several admin menu items** Several admin menu items have been removed:
  * The 'Form-links' page has now been removed in favor of the new 'Process links' page.
  * The 'Contexts' page has been removed. Valtimo no longer supports contexts.
  * The 'Users' page has now been removed.
  * The 'Entitlements' page has now been removed in favor of the new 'Access control' page.
* **Removed case 'Entitlements'** The case management page no longer has the option to set the entitlements. This has been replaced by the new 'Access control' page.

Instructions on how to migrate to this version of Valtimo can be found [here](migration.md).

## Deprecations

No new deprecations.

## Known issues

* **Two types of process link can't be saved**
  * Discovered in version 11.0.0
  * The 'generate document' (SmartDocuments plugin) and the 'create Portaaltaak' (Portaaltaak plugin) plugin actions can't be configured due to a broken multi-input field. This has been fixed in Valtimo 11.1.
* **Loading icon visible after completing the process**
  * Discovered in version 11.0.0
  * On the case detail page, a loading icon is visible when the tasks are being retrieved from the backend. When the process has ended, the loading icon persists.
* **Incomplete export of permissions for a specific role**
  * Discovered in version 11.0.0
  * Download the export from the access control list page instead.
