# Valtimo frontend libraries (5.5.0)

## New Features

The following features were added:

*   **Saving process links**

    When the form of a new plugin action is filled in on the new process links screen, it can now be saved through the API. When an activity already has a process link, clicking on it displays this process link, which can then be altered. More information on plugins can be found [here](../../../using-valtimo/plugin/create-process-link.md).
*   **New field SmartDocuments plugin action 'generate document'**

    The SmartDocuments plugin now takes an extra parameter for the 'generate document' action: 'resultingDocumentProcessVariableName'. This plugin stores the generated document locally, and other plugins can be used to send it to another service.
*   **Warning added to SmartDocuments plugin action 'generate document'**

    The warning is related to the field `resultingDocumentProcessVariableName`, and states 'This action generates a temporary file. It needs to be stored in a following task.'
*   **Tooltips in @valtimo/user-interface**

    Tooltip functionality has been added to the input components of the `@valtimo/user-interface` library.
*   **Required fields in @valtimo/user-interface**

    All input components now display a required asterisk when the required input is `true`.
*   **Password input field for @valtimo/user-interface**

    The `v-input` component now supports the input type `password`, which hides input by default. A button is shown to toggle visbility.
*   **Documenten API plugin added to @valtimo/plugin**

    The Documenten API plugin has been added and supports plugin configuration and configuration for the action `store-temp-document`.

## Bugfixes

The following bugs were fixed:

*   **Sanitization of HTML in timeline component**

    Some HTML icons from the translation assets were not displayed properly, since text on the timeline component is now sanitized before being displayed. These icons have been replaced by text symbols.

## Breaking changes

No known breaking changes.

## Deprecations

No new deprecations.

## Known issues

No new known issues.
