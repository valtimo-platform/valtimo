# Valtimo frontend libraries (5.11.0)

## New Features

The following features were added:

*   **New Documenten API Form.IO upload component**

    A new custom Form.IO component has been added to upload one file at a time, with a modal to input metadata for the Documenten API. The component can be inserted into a Form.IO form after following [these instructions](../../../features/zgw/zgw-documents/upload-to-documenten-api-with-metadata.md). When configuring the component in the form builder, various metadata inputs can be given a default value, or be disabled. If the component is included in a form for a user task, the user can input metadata for each file upload. These files are then registered in the Documenten API on form submission.
*   **New date format possible for date columns in the Valtimo lists**

    The `viewType` property for listFields is extended with the option to add set a custom format based on the library that we use `moment.js`. Before you would declare a date column as `viewType: 'date'` and now you can add a optional format option like this `viewType: date:DD-MM-YYYY`. After the separator `(:)` any `valid moment.js` formatting is allowed. A full list of all the moment.js format options can be [found here](https://momentjscom.readthedocs.io/en/latest/moment/04-displaying/01-format/).
*   **Added parameters to the 'ValtimoFormioOptions' class**

    The parameters `readOnly` (boolean), `decimalSeparator` (string) and `thousandsSeparator` (string) are added to the 'ValtimoFormioOptions' class. You can now pass these parameters inside an 'options' object when using the `valtimo-form-io` Angular component.
*   **Override default task list tabs**

    A new (optional) environment property `visibleTaskListTabs` is introduced to change the visibility of the default tabs in the `valtimo-task-list` component. The new property is an array which include the tabs that need to be visible on the page. The array can include the following values: `TaskListTab.MINE`, `TaskListTab.OPEN`, and `TaskListTab.ALL`.

    With this new property you can either hide certain tabs that are visible by default or you could change the default order of the tabs.

## Bugfixes

The following bugs were fixed:

*   **Removed the retry in the HttpInterceptor**

    Before the interceptor would always retry an API call if it failed previously. This functionality has been removed since it could break applications when timeout (504) errors where being thrown.
*   **Assign user in task subscription not destroyed**

    Everytime when the API for getting the list of Valtimo users in a task was loading, it would keep loading even if the task was already completed. The subscription is now properly killed and if the task is already completed the API won't be loading anymore.
*   **Added missing translations for several components**

    The components `summary page`, `taskDetailModal`, and `list component` were missing translations

## Breaking changes

No breaking changes.

## Deprecations

No new deprecations.

## Known issues

This version has the following known issues:

* **Experimental DMN editing**
  * Editing only works for DRM file with a single DRM table. If multiple tables exist, the overview list of decision tables shows multiple entries.
  * It is not possible to create a new DMN table from scratch from the ui.
  * It is not possible to edit the key of a DMN table.
*   **Missing flatpickr dependency**

    In front-end libraries verison 5.10.0, a new datepicker component has been added to `@valtimo/user-interface`. This component has a dependency on `flatpickr`, however, this was not included in the dependencies of `@valtimo/user-interface`. This dependency will be included in a future version.

    To fix this for now, add the latest version of `flatpickr` to the dependencies of the implementation by running `npm install flatpickr`.
