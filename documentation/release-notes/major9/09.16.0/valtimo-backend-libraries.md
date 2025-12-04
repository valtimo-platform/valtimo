# Valtimo backend libraries (9.16.0)

## New Features

The following features were added:

*   **Camunda webapps**

    The Camunda webapps, including the cockpit, were made available. For existing Valtimo projects additional infrastructure configuration might be required to grant access to the `/camunda/app/` path. See [this page](../../../valtimo-implementation/modules/core/camunda-webapps.md) for more information.
*   **Plugins**

    Plugins are extensions on the Valtimo platform. These are often connections to external services, such as transactional email and generating documents. Some plugins are provided by the platform, but developers can create their own plugins as well. Plugins can be configured without writing code, and can be used during BPMN processes. See [this page](https://app.gitbook.com/s/bcArISKZtxWk4tKpZb9P/features/plugins) for more information.
*   **SmartDocuments plugin**

    The SmartDocuments plugin has been added. This plugin connects to a SmartDocuments service to generate documents based on a template and placeholders. See [this page](../../../fundamentals/architectural-overview/modules.md)

## Bugfixes

The following bugs were fixed:

*   **Input sanitization for pre-filled fields inside of forms**

    When a form definition is pre-filled, the pre-filled fields were prone to HTML injection. These fields are now sanitized when the fields are pre-filled.
*   **Slow form association retrieval**

    Form associations are retrieved on several locations within the application. For example, when opening a task a form is retrieved. Retrieving this form becomes slow when multiple forms are associated to a single process. To solve this issue, form associations are no longer stored as JSON in the database. Form associations are now stored in a new table with proper indexing and without JSON columns.

## Breaking changes

No breaking changes.

## Deprecations

No new deprecations.

## Known issues

This version has the following known issues:

*   **Multiple existing form associations on process definition**

    When multiple start forms are associated with a single process definition the user is unable to start a new case of that specific type.
* **Updating process variables from a form.io submission**\
  Only process variables of type `String` and `Array<String>` are currently supported by the pv. form.io prefix. Any other types will be set to a null value.
*   **Using formAssociationService.createFormAssociation() on application startup causing the application to crash**

    When form associations are created on application startup, using the formAssociationService.createFormAssociation() method, these associations are duplicated. Before the bugfix in this release these duplicated associations were added without errors. After the bugfix in this release the application will throw an exception when creating an already existing association, causing the application to crash on startup.

    Solution: the correct way to add form associations is by adding [form link files](../../../using-valtimo/form-link/configure-task.md). Using of formAssociationService.createFormAssociation() should be replaced with form link files.
