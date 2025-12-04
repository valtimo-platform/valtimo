# Valtimo frontend libraries

## New Features

The following features were added:

*   **Loading indicator Documenten API documents tab**

    The documents tab shown on a case detail page when Documenten API has been configured as the upload provider, now shows loading animations when loading the list of files linked to the case, and when downloading files.
*   **Added featureToggle to make the application title a suffix**

    By default, the application title is shown in the browser tab as a prefix e.g. 'Valtimo - Processes'. We have added the featureToggle `applicationTitleAsSuffix` to be able to change this to 'Processes - Valtimo' from the environment files.
*   **Configuration component for the 'Link Document to Besluit' plugin action**

    The 'Link Document to Besluit' plugin action under the Besluiten API plugin now includes a front-end configuration component.
*   **Configuration components for Catalogi API plugin actions**

    The following Catalogi API plugin actions now have configuration components:

    * Retrieve Statustype
    * Retrieve Resultaattype
    * Retrieve Besluittype
*   **Triggering fresh searches every time**

    The search functionality on the case list page has been improved to trigger a search every time, even if the search term has not changed. This change enables users to search seamlessly, even when working with asynchronous data.
*   **Case list refactor**

    Over time, much functionality had been added to the case list page. All these elements did not always work together properly, nor were they optimal from a user experience perspective. The case list component has been refactored with the following points in mind:

    * State (pagination, sorting) is no longer saved in the local storage. When navigating to the case list page of a document definition, the default state as configured in the environment file or in the API is shown.
    * The current assignee filter is now saved in query parameters in the URL.
    * When navigating to a case list page using a URL with query parameters, the list state (pagination, sorting, search, assignee filter) is restored from these parameters. This includes going back to the case list page from a case detail page using the back button.
*   **Task forms are now retrieve using a new API**

    When opening a user task, the form is now loaded using the new API endpoint:

    `GET /api/v2/process-link/task/{id}`
*   **Upgraded deprecated `carbon-components` package in `@valtimo/components` to `@carbon/styles`**

    One of the Carbon Design System packages was deprecated and has been upgraded to the new package
*   **New process links screen**

    The process links screen (/process-links) has been updated to use Carbon design. The linking of forms, FormFlow and plugin actions to a process step is now unified in a single modal. From this same modal, process links can also be edited and unlinked.
*   **User settings / navigation bar always collapsible**

    The right sidebar now saves the currently selected language in the database under user settings, which means that the language a user has selected will be the default when they log in with another device. In addition, a setting to always make the navigation bar collapsible, regardless of screen size, has been added. This setting is also stored in the database and thus the same on any device the user uses.
*   **Maximum of 20 SmartDocument placeholders**

    The maximum number of 20 SmartDocument placeholders has been removed. It is now possible to enter many more placeholders. The maximum has been removed for all multi-input components within Valtimo. Which means that the maximum has also been removed for other features, such as the Verzoeken plugin mapping.

## Bugfixes

The following bugs were fixed:

*   **Context detail not loading properly**

    Fixed an issue where the buttons next to the processes weren't initialized properly.
*   **Modal dispersal on error when creating an object in Object management**

    The modal will now stay open and an error will be shown when used enters invalid information when creating an object.
*   **Case list bug fixes**

    In conjunction with the case list refactor mentioned under new features, the following issues were fixed:

    * Boolean values (displayed as Yes/No) are now translated.
    * When navigating to a case list page without query parameters, the default sort as specified in an environment file or in the API is now used on first load.
    * Date formats specified in list columns of type date are used to correctly display the date value in the desired format.
    * List columns configured using `defaultDefinitionTable` or `customDefinitionTables` did not handle array values properly. It now shows and sorts columns properly when using a propertyName like `$.testArray[0].value`
*   **Case configuration bug fixes**

    On double refresh of the Configuration modal, the "Link upload process to case" no longer gets emptied.
* **Form dropdown list on object management page not loading all forms** When there were more than 50 forms available not all of them would be listed in the view and edit form dropdowns on the edit page of the object management definition. This has now been resolved.
* **Plugin configuration**
  * Secret visibility is no longer toggled when pressing "Enter" while configuring plugins.
  * Plugin configuration modal now stays open until the configuration is successful.

## Breaking changes

The following breaking changes were introduced:

*   **Process link V2**

    The existing method: `TaskService.getTaskProcessLink()` will now respond with process links V2 instead of V1. A new method has been introduced that still works with V1 process links: `TaskService.getTaskProcessLinkV1()`

Instructions on how to migrate to this version of Valtimo can be found [here](migration.md).

## Deprecations

No deprecations.

## Known issues

No known issues.
