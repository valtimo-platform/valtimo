# Valtimo frontend libraries

## New Features

The following features were added:

*   **Angular upgrade to version 14**

    Angular has been upgraded from version 13 to version 14. [This version supports many new features](https://blog.angular.io/angular-v14-is-now-available-391a6db736af). To be able to use the libraries with this new version, please refer to [the migration page for this release](migration.md).
*   **Carbon design system**

    The interface shell (top bar, sidebars, page layout) has been refactored to make use of the [Carbon design system](https://carbondesignsystem.com/). Future features will be built using Carbon components, and existing components will be gradually replaced by Carbon components. Implementations are also recommended to make use of Carbon components.

    Refer to [this page](migration.md) for instructions on how to adjust your implementation to work with Carbon.

    Refer to [this page](../../../nog-een-plek-geven/reference/user-interface/carbon-design-system.md) for an instructions on how to use Carbon, and how to develop a custom Carbon theme.
*   **Dependency upgrades**

    Many dependencies in the libraries have been upgraded to the latest versions. To be able to use the libraries with these new versions, please refer to [the migration page for this release](migration.md).
*   **Removed Auth0 library**

    As of major version 10, support for Auth0 as an authentication provider has been removed. Please refer to [the migration page for this release](migration.md) to see how implementations should be adjusted.
*   **Change valtimo libraries versions**

    Changed the following libraries versions to be the same as it is in the backend (10.0.x):

| Dependency                    | Old version | New version |
| ----------------------------- | ----------- | ----------- |
| @valtimo/account              | 5.10.0      | 10.0.0      |
| @valtimo/analyse              | 5.10.0      | 10.0.0      |
| @valtimo/auth0                | 5.10.0      | 10.0.0      |
| @valtimo/bootstrap            | 5.10.0      | 10.0.0      |
| @valtimo/authority            | 5.10.0      | 10.0.0      |
| @valtimo/choice-field         | 5.10.0      | 10.0.0      |
| @valtimo/choicefield          | 5.10.0      | 10.0.0      |
| @valtimo/components           | 5.10.0      | 10.0.0      |
| @valtimo/config               | 5.10.0      | 10.0.0      |
| @valtimo/connector-management | 5.10.0      | 10.0.0      |
| @valtimo/contact-moment       | 5.10.0      | 10.0.0      |
| @valtimo/context              | 5.10.0      | 10.0.0      |
| @valtimo/customer             | 5.10.0      | 10.0.0      |
| @valtimo/dashboard            | 5.10.0      | 10.0.0      |
| @valtimo/decision             | 5.10.0      | 10.0.0      |
| @valtimo/document             | 5.10.0      | 10.0.0      |
| @valtimo/dossier              | 5.10.0      | 10.0.0      |
| @valtimo/dossier-management   | 5.10.0      | 10.0.0      |
| @valtimo/form                 | 5.10.0      | 10.0.0      |
| @valtimo/form-link            | 5.10.0      | 10.0.0      |
| @valtimo/form-management      | 5.10.0      | 10.0.0      |
| @valtimo/keycloak             | 5.10.0      | 10.0.0      |
| @valtimo/layout               | 5.10.0      | 10.0.0      |
| @valtimo/management           | 5.10.0      | 10.0.0      |
| @valtimo/migration            | 5.10.0      | 10.0.0      |
| @valtimo/milestone            | 5.10.0      | 10.0.0      |
| @valtimo/open-zaak            | 5.10.0      | 10.0.0      |
| @valtimo/plugin               | 5.10.0      | 10.0.0      |
| @valtimo/plugin-management    | 5.10.0      | 10.0.0      |
| @valtimo/process              | 5.10.0      | 10.0.0      |
| @valtimo/process-management   | 5.10.0      | 10.0.0      |
| @valtimo/resource             | 5.10.0      | 10.0.0      |
| @valtimo/security             | 5.10.0      | 10.0.0      |
| @valtimo/swagger              | 5.10.0      | 10.0.0      |
| @valtimo/task                 | 5.10.0      | 10.0.0      |
| @valtimo/user-interface       | 5.10.0      | 10.0.0      |
| @valtimo/user-management      | 5.10.0      | 10.0.0      |
| @valtimo/view-configurator    | 5.10.0      | 10.0.0      |

*   **REST API versioning**

    As of major version 10, REST API versioning has been introduced to the backend libraries. The frontend libraries have been adjusted to make use of these new versioned endpoints.

## Bugfixes

No bugfixes.

## Breaking changes

A number of breaking changes have been made. Please refer to the [migration guide](migration.md) for more details.

## Deprecations

No new deprecations.

## Known issues

This version has the following known issues:

* **Viewing and editing DMN tables does not work if there is no 'featureToggles' object present in the environment configuration.**
  * Discovered in version 9.26.0
  * As a workaround, an empty 'featureToggles' object can be added to the environment configuration file(s).
