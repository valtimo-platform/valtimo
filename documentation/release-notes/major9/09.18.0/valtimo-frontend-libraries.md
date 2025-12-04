# Valtimo frontend libraries (5.6.0)

## New Features

The following features were added:

*   **Show full name of user in the top bar**

    The full name of the logged-in user can now be shown in the top bar. To enable this feature, set `showUserNameInTopBar` to true under `featureToggles` in your environment file(s).
*   **Modify and delete plugin configurations**

    On the plugin management page plugin configurations can now be modified and/or deleted from a modal window, after clicking on edit next to an existing plugin configuration.
*   **Support multiple ZGW API implementations**

    The libraries `@valtimo/plugin`, '@valtimo/plugin-management' and `@valtimo/user-interface` have been modified to support multiple implementations for each ZGW API. For now, an authentication plugin configuration can be selected under the Documenten API plugin. The existing OpenZaak plugin code has been refactored to serve as an authentication plugin. Associated changes:

    * Process link screen now shows the plugin names with configuration titles for clarity.
    * The `PluginManagementService` and associated models have been moved to `@valtimo/plugin` from `@valtimo/plugin-management`, to support using its methods inside plugins.
    * Added a `digitOnly` input directive to `@valtimo/user-interface`, now used for a RSIN input field.
* **Added the following ZGW plugins**
  * Open Zaak API
    * This plugin has no actions but contains the ability to make a connection to Open Zaak. Other plugins can use this plugin as an authentication configuration
    * In order to use this plugin add the `OpenZaakPluginModule` and `openZaakPluginSpecification`, from the module `@valtimo/plugin`, to your `app.module.ts`
  * Documenten API
    * This plugin creates a connection to the Documenten API.
    * It currently has a single action available, it enables to read a process variable containing a location to a temporary file stored locally and upload that document to the Documenten API. The URL to new location will be stored in a new process variable
    * Added tooltips to multiple fields of the configuration of the plugin and its action for information about the purpose of a field
    * The authentication for this plugin is controlled by a separate plugin like the Open Zaak API Plugin
    * In order to use this plugin add the `DocumentenApiPluginModule` and `documentenApiPluginSpecification`, from the module `@valtimo/plugin`, to your `app.module.ts`
  * Zaken API
    * This plugin creates a connection to the Zaken API.
    * It currently has a single action available, it will use a URL to a document (this could be an actual API or a process variable containing the API) and link it to the Zaak and the case
    * Added tooltips to multiple fields of the configuration of the plugin and its action for information about the purpose of a field
    * The authentication for this plugin is controlled by a separate plugin like the Open Zaak API Plugin
    * In order to use this plugin add the `ZakenApiPluginModule` and `zakenApiPluginSpecification`, from the module `@valtimo/plugin`, to your `app.module.ts`
*   **New option to override default column sort direction from environment file for custom case definition columns**

    The `DefinitionColumn` interface (exported from `@valtimo/config`), now supports the type `Direction` on its key `default`.

    This can be either '`ASC`' or '`DESC`', in addition to the currently supported `boolean` value.

    **For example:**

    If set to '`ASC`', the case list will be explicitly sorted ascendingly on the column with this value on the property `default` (in the environment file). If `default` is set to **true**, the column is sorted descendingly on this property, but this will not be visible to the user, which was the default behaviour before this change was made.

    **Please be mindful that list sorting states stored in the local storage will override this setting.**
*   **Added new tooltip directive to the user-interface library**

    Previously, `@valtimo/user-interface` supported tooltips through the `NgbTooltipModule`. However, this led to positioning issues. A custom directive has been added based on [this guide](https://indepth.dev/posts/1146/tooltip-with-angular-cdk). It is based on `@angular/cdk`. To use this tooltip, import the `TooltipModule` from `@valtimo/user-interface` and add the tooltip directive to an element like so:

    **`sample.component.html`**

    ```angular2html
    <p vTooltip="{{ 'tooltip text' }}"></p>
    ```

## Bugfixes

The following bugs were fixed:

*   **Downgraded `@ng-bootstrap/ng-bootstrap` dependency**

    Recently the dependency `@ng-bootstrap/ng-bootstrap` was upgraded to major version 12 throughout the libraries. This caused problems in implementations, as it requires version 5 of Bootstrap, and the libraries use version 4. [`@ng-bootstrap/ng-bootstrap` version 11 is compatible with Bootstrap version 4 and Angular 13.](https://www.npmjs.com/package/@ng-bootstrap/ng-bootstrap)
*   **Locked `swagger-ui` dependency version**

    The dependency `swagger-ui` was upgrading to `4.13.0`, which was causing issues in implementations. The version has now been locked to version `4.12.0`.
*   **Fix no form definition found warning message**

    On opening a task, when a form definition could not be found, a message was shown `formManagement.noFormDefinitionFound`. This has now been changed in the support process start modal and the task detail modal to show a translated warning message.

## Breaking changes

No known breaking changes.

## Deprecations

No new deprecations.

## Known issues

This version has the following known issues:

* **Cases sort by default on the same property key**
  * Discovered in version 9.18.0
  * When two cases are sorted by default on the same property key and switched between them, one follows the sorting direction of the other.
