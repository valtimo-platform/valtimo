# Valtimo frontend libraries

## New Features

The following features were added:

*   **Notificaties API plugin added to @valtimo/plugin**

    The Notificaties API plugin has been added and supports plugin configuration.
*   **Current user Form-io custom component**

    A custom form-io component has been added that provides the Valtimo user profile as form input.
*   **Form flow - store submission data when moving to the previous step**

    A user now gets the option to save changes in the form when the user clicks the button to go to the previous step in the form flow.
*   **Introducing a new case tab 'Notes'**

    A new case tab `Notes` has been added which brings the following functionalities:

    * Add a new note to a case.
    * A view of all the notes that have been added to a case.

    Currently, it's not possible to delete or update a note.
*   **Moved Audit time**

    The audit time is now displayed next to the date.
*   **Modified audit trail dots**

    The audit trail dots are now all the same color.
*   **Plant a tree button**

    There is now a button in the sidebar under the logout button that sends an e-mail to request ritense to plant a tree.
*   **Editing case list columns**

    On the admin page of a case type, a tab 'List' is now available. On this tab, case list columns for this case type can be added, modified, and re-ordered.

## Bugfixes

The following bugs were fixed:

*   **caseassignee dropdown breaks when user has no lastname in keycloak**

    When a user has been configured in keycloak without a lastname, the dropdown of the caseassignee breaks. A check as been added to handle users without a lastname.
*   **Custom case header not working if canHaveAssignee is disabled**

    The custom header was only working if the setting `canHaveAssignee` was enabled in the case settings. A fix has been applied to make the custom case header also work without this setting enabled.
*   **Connector configuration shows wrong configuration**

    The popup to edit a connector configuration properties, sometimes showed the properties of another connector. This has been fixed.
*   **Wrong url on 'back' button on Form creation page**

    On the Form creation page (/form-management/create), the back button directed the user to an non-existing URL. This caused the user to be redirected to the dashboard. The URL has been changed to the correct one.

## Breaking changes

No breaking changes.

## Deprecations

No new deprecations.

## Known issues

This version has the following known issues:

* **Viewing and editing DMN tables does not work if there is no 'featureToggles' object present in the environment configuration.**
  * Discovered in version 9.26.0
  * As a workaround, an empty 'featureToggles' object can be added to the environment configuration file(s).
