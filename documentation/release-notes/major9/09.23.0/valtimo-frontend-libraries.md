# Valtimo frontend libraries (5.12.0)

## New Features

The following features were added:

*   **Added default assignee column to the case list**

    Added a new default column to the `valtimo-dossier-list` component, which displays the full name of the assignee for each case when present. This column is sortable, considering the first name and then the lastname.

    To display the new column, it is required to add data in the `environment.ts` file (see example below).

    **`environment.ts`**

    ```typescript
    export const environment: ValtimoConfig = { ...
      {
      propertyName: 'assigneeFullName',
      translationKey: 'assigneeFullName',
      sortable: true,
      }
     }
    ```
*   **Added modifier property to customDossierHeaderItems**

    In a `customDossierHeaderItem` you can now pass a `modifier` property to modify how the data for the header item is rendered. The only allowed modifier at this moment is the `age` modifier which renders a date string as an age (see example below).

    ```typescript
    customDossierHeader: {
      dossierName: [
        {
          labelTranslationKey: 'Age',
          propertyPaths: ['personA.dateOfBirth'],
          modifier: 'age'
        }
      ]
    }
    ```
*   **Added warning message to user management page**

    In case Keycloak is used for IAM, the user management page now shows a warning message stating that user management is only supported within Keycloak.

    The message can be customized by using the translation key `userManagement.notSupported`.
*   **Added 'Claim' button on case detail page**

    Added a default button on the case details page to `claim` a case directly to the user logged into the application.

    The case will be assigned to the user when clicking on this option. The `claim` button is disabled when the case is already assigned to the logged-in user.
*   **Added demo version of case search fields**

    Search functionality for the case list will be replaced by configurable fields in future versions of Valtimo. A demo version of the front-end for these new search fields is included in this release. This feature is not yet functional.

    For testing purposes, this feature can be enabled through the `caseSearchFields` feature toggle. For more information, refer to [this page](../../../running-valtimo/application-configuration/feature-toggles.md).

## Bugfixes

The following bugs were fixed:

*   **Semicolon in customDossierHeaderItem**

    The semicolon between label and value in custom dossier header items were rendered when only a `labelTranslationKey` was defined. It will now only render a semicolon when both the `labelTranslationKey` and the `propertyPaths` are defined.
*   **Improved mouse pointer on user tasks**

    Clickable elements (like tasks) showed an incorrect mouse pointer. This has been fixed.
*   **Flatpickr inside Form.io form could not get locale**

    When Flatpickr (date picker) was used inside a Form.io form, it could not properly determine the locale. The application language is passed to the Form.io component in a different way now, resolving the error.

## Known issues

This version has the following known issues:

* **Assignee change via process does not update user interface**
  * Discovered in version 9.23.0 RC
  * Since 9.23.0 it is possible to update the assignee using a process. When the process is executed the frontend will not show the new assignee until the page has been refreshed.
