# Valtimo frontend libraries

## New Features

The following features were added:

*   **Improved support for plugin auto-deployment properties placeholders**

    A plugin configuration auto-deployment file now supports:

    * Placeholders that refer to Java system properties.
    * Placeholders inside nested properties.
    * Multiple placeholders in a single field.
*   **Added PendingChanges guard and modal to prevent losing unsaved changes**

    Implemented a mechanism for checking wether or not any changes have been made to the current page. If any navigation occurs on these pages, a modal will pop up asking for confirmation in case any unsaved changes exist.
*   **Case tabs**

    Custom case tabs can now be managed from within the application. This can be used after enabling the [feature toggle](../../../running-valtimo/application-configuration/feature-toggles.md) `enableTabManagement`.

    Instructions on how to set this up can be found [here](../../../features/case/for-developers/case-tabs.md).

## Bugfixes

The following bugs were fixed:

*   **Remove hardcoded Form.io app configuration**

    Previously the [app configuration](https://help.form.io/developers/introduction/application) supplied to Form.io contained a hardcoded URL to the development environment. This has been corrected. The Form.io instance running in Valtimo now uses the URL and the API URL of the environment it is running in.
*   **Data is lost when accidentally navigating back when editing a form**

    When editing a form and navigating to a different page, a modal pops up asking for confirmation.
*   **FormIO token refreshes only once**

    When using the **valtimo-form-io** component from _@valtimo/components_, the local storage property _formioToken_ gets updated every time the token refreshes after expiring.
*   **Task list loading**

    The task list on a case detail page would show a spinner indefinitely when all tasks were completed.

## Breaking changes

No breaking changes.

## Deprecations

No deprecations.

## Known issues

* **Incomplete export of permissions for a specific role**
  * Discovered in version 11.0.0
  * Download the export from the access control list page instead.
