# Valtimo frontend libraries (5.14.0)

## New Features

The following features were added:

*   **Download case search fields configuration**

    If the `caseSearchFields` feature toggle is enabled, a 'Search Fields' tab is shown on the Case details page (i.e. Admin -> Cases -> Leningen). On this tab, a 'Download search field configuration' button is now shown, which downloads the search field configuration for the current document type as a JSON file.

    For more information on how to enable the `caseSearchFields` feature toggle, refer to [this page](../../../running-valtimo/application-configuration/feature-toggles.md).
*   **Added new actions to case search field configuration**

    Creating, updating, deleting, and reordering search field rows for a document definition are now available actions.

    For more information on this feature, see [this page](broken-reference).
*   **Persist query parameters after Keycloak redirect**

    Previously after a redirect by Keycloak, only the main URL was restored, so that the user remained on the same page. To this functionality, saving and restoring of query parameters has been added. Now, after a Keycloak redirect, the previous query parameters will remain in place.
*   **Added a new input field for case search field configuration modal**

    Add new input to configure the case search field `title`.

    The `title` is an optional field that appears as a label for the current search field. When the `title` is not set, the default value will be the search field key translation (if there is no translation available, the original key value will be displayed).

    For more information on this feature, see [this page](broken-reference).
*   **Add `boolean` and `datetime` type for search fields configuration**

    Added two new types for configuring search fields.

    The `boolean` field provides a selector with the following options: `yes` and `no`. The search will considers both options if the dropdown selection is left blank.

    The `datetime` field displays a calendar with the option to add a time. It is possible to create this search field with the match type **single** and **range** option.

    For more information on this feature, see [this page](broken-reference).
*   **Added 'Clear' and 'Search' functionality in the search fields panel**

    Navigating to the cases page (`Cases` -> ex.: `Leningen`), within the **Search** panel, two new buttons are located at the bottom to **Clean** and **Search** the data in the search fields.

    **Search**: Clicking the search button performs the case search based on the entry in the case search fields, and returns a list of the data found.

    **Clear**: Clicking the clear button, clears all search field values and resets the case list to show all cases.

## Bugfixes

The following bugs were fixed:

*   **Enum BooleanTypeConverter**

    Fixed the ability to provide custom values enum to BooleanTypeConverter. An example how this can be configured in environment as a property in a DefinitionColumn.

    `{ propertyName: '$.isPropertyTrue', translationKey: 'isPropertyTrue', sortable: true, viewType: 'boolean', enum: ['Ja', 'Nee'] },`

    The enum property only accepts maximum two string values where the first one is for true and the second one is for false.

## Breaking changes

No breaking changes.

## Deprecations

No new deprecations.

## Known issues

This version has the following known issues:

* **Case search fields**
  * Discovered in version 5.14.0 RC
    * Some case search fields can be configured, but lead to errors when performing searches. One known broken search field configuration is searching for `boolean` ranges.
    * Date/time searches do not always function correctly because of time zone issues.
    * After a 500 error occurs on a search action, the front-end does not recover, and the page has to be refreshed in order to perform another search. In order to avoid this, configure only valid search fields. Avoid the example mentioned in the first point of this list (`boolean` ranges).
* **Persisting query parameters on Keycloak redirect**
  * Discovered in version 5.14.0 RC
    * When a case detail page is opened, query parameters do not persist after a Keycloak redirect.
