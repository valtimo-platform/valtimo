# Valtimo backend libraries (9.26.0)

## New Features

The following features were added:

*   **Case settings**

    Case settings have been introduced. Settings such as being able to assign a user to a case can be found here. Additionally, case settings can be loaded from a file when the corresponding document definition is created. For more information on how to create a case definition when a document definition is created, see [here](https://app.gitbook.com/s/bcArISKZtxWk4tKpZb9P/features/case/configuration).
*   **Smart documents logs improvements**

    Added more logging for the smart documents connector so that the error messages give more specific information.

## Bugfixes

The following bugs were fixed:

*   **Enhanced error information on form submission errors**

    When you try to submit a form whose `Document` or `ProcessDocumentDefinition` can't be found, the parameters used to query these entities will be logged/reported back. This is especially useful when you encounter this error on a system that you don't have direct access to.
*   **Listing connectors could potentially exhaust the database connection pool**

    When requesting a list of connectors, some queries were locking the tables. This could result in an exhausted database connection pool. The transaction settings have been changed to prevent this from happening.

## Breaking changes

The following breaking changes were introduced:

*   **Case settings**

    In order to support case settings, a new module `case` was introduced which is required to be used in Valtimo applications.

Instructions on how to migrate to this version of Valtimo can be found [here](migration.md).

## Deprecations

No new deprecations.

## Known issues

No new known issues.
