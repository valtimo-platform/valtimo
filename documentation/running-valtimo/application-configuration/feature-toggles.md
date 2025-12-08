# Feature toggles

Sometimes, different features in implementations need to be switched on or off. This could be because a feature is (not) needed, or a feature is currently in development and is switched off by default, enabling the release chain to continue uninhibited.

Below is an overview of available feature toggles for Valtimo, with a short description of their function.

## Front-end

In the frontend, feature toggles can be configured under the `featureToggles` key in the Angular environment file(s) with a `boolean` value.

*   **`applicationTitleAsSuffix`**

    By default, the application title is shown in the browser tab as a prefix e.g. 'Valtimo - Processes'. With this featureToggle it is possible to change this to 'Processes - Valtimo'.
*   **`showUserNameInTopBar`**

    If enabled, the full name of the user currently logged in is shown in the top bar next to the user menu button.
*   **`experimentalDmnEditing`**

    If enabled, it is possible to edit DMN tables from the ui from the admin page. This feature is experimental, please refer to [the release notes](../../release-notes/9.x.x/9.20.0-5.9.1/valtimo-frontend-libraries.md) for known issues.
*   **`disableCaseCount`**

    If set to `true`, showing the number of open cases in the menu is disabled.
*   **`caseListColumn`**

    If enabled, the column list tab will be shown on the case management page. Enabled by default when not configured.
*   **`showPlantATreeButton`**

    If enabled, a 'Plant a tree' button will appear in the right sidebar.
*   **`sortFilesByDate`**

    If enabled, files under the documents tab on a case detail page will be sorted by date in descending order.
*   **`largeLogoMargin`**

    If enabled, the logo on the left in the top bar will have a large margin around it. This works well for logo's that are bigger horizontally than they are vertically.
*   **`returnToLastUrlAfterTokenExpiration`**

    If enabled, the user will be returned to the page they were last on before they were automatically logged out after their refresh token expired.
* **`enableCompactModeToggle`** \
  If enabled, the user can toggle compact mode in the user settings. When both toggles are enabled, this will free up vertical space by moving the breadcrumbs and page title to the top header next to the logo.&#x20;
* **`enableFormFlowBreadCrumbs`** \
  If enabled, users will see a new breadcrumb trail on top of every form flow. This allows a user to quickly navigate between the different steps of the form flow. See [this page](../../features/case/form-flow.md#bread-crumbs) for more information.
*   **`enableObjectManagement`**

    If enabled, a new menu item 'objects' will appear in the left sidebar menu. Enabled by default when not configured. This menu item can have one or more submenu items depending on the configuration. For more information [here](../../fundamentals/getting-started/modules/zgw/object-management.md)
*   **`hideValtimoVersionsForNonAdmins`**

    If enabled, the Valtimo version information in the right sidebar will only be visible for admins and will be hidden for any other users.
*   **`enableTabManagement`**

    If enabled, tabs will be configured for each case type in the back-end. Enabled by default when not configured. For more information on this option, visit [this page ](../../features/case/for-developers/case-tabs.md). If disabled, the tabs for each case type will be the same, and will be configured from the `AppModule`. For information on this option, visit [this page](https://github.com/valtimo-platform/valtimo-documentation/blob/main/running-valtimo/application-configuration/broken-reference/README.md).
*   **`useStartEventNameAsStartFormTitle`**

    If enabled, BPMN start event names will be used as title for start forms instead of the standard `Start - ${process-name}` format.
*   **`allowUserThemeSwitching`**

    If enabled, a new dropdown will appear in user settings, where the user can switch between themes. This feature toggle is enabled by default.
* **`enableIntermediateSave`** \
  If enabled, user will be able to save their progress on a form and continue later. This feature toggle is enabled by default.
*   **`enablePbacDocumentenApiDocuments`**

    If enabled, access to the list of uploaded documents now requires permissions. Additionally, the backend requires the following property to be set in `application.yml`:\
    `valtimo.authorization.zgwDocuments.enabled`

## Backend

In backend, feature toggles can be configured in the `application.yml` file.

*   **`valtimo.includeDocumentContentInResponse`**

    If enabled, returns the content of the document when this is retrieved via the REST endpoint. This should only be
    used for debug purposes, normally content is retrieved through tabs and their widgets.
