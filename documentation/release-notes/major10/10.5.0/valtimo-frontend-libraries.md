# Valtimo frontend libraries

## New Features

The following features were added:

*   **Use new endpoint to retrieve and download documents from the Zaken API**

    When `uploadProvider` is set to `UploadProvider.DOCUMENTEN_API` in the environment file, a custom documents page is displayed under the documents tab on a case detail page. The documents displayed in the table on this page are now retrieved using a Zaken API plugin configuration, by using the new endpoint included in this release:

    `/api/v1/zaken-api/document/${documentId}/files`

    When clicking a file in the retrieved list, it is now download through the following endpoint

    `/api/v1/documenten-api/{pluginConfigurationId}/files/{documentId}`
*   **Only show date on Documenten API documents tab**

    Since the Documenten API only returns dates for files (not specific times) the Documenten API tab component has been adjusted to only display dates.
*   **Sort files on documents tab on case detail page by date**

    A feature toggle has been added to enable sorting files related to a case on the documents tab of the case detail page by date in descending order. In order to use this, use the `sortFilesByDate` feature toggle. For more information, refer to [this page](../../../running-valtimo/application-configuration/feature-toggles.md).
*   **Return to same page after token expiration**

    After a user's refresh token expires, the user is logged out automatically. A feature has been added to redirect the user to the page they were on before they were automatically logged out, after they login again. To enable this feature, enable the feature toggle `returnToLastUrlAfterTokenExpiration`. For more information, refer to [this page](../../../running-valtimo/application-configuration/feature-toggles.md).
*   **Configuration component for the 'Delete object' plugin action**

    The action 'Delete object' for the Objecten API plugin is now supported in the front-end through a configuration component.
*   **Mapping Verzoek Object to GZAC document**

    For each Verzoek type under a Verzoek plugin configuration, a mapping can now be optionally configured. This specifies which fields should be copied from the Verzoek object to the document, instead of copying the entire object.
*   **Form.io translations enabled**

    Valtimo's form.io components did not utilize the built-in translation functionality for labels and content. By enabling this feature, translations can now be added to an implementation.

    To add translations, include the following property in the i18n files:

    ```
    "formioTranslations": {
      "<Label>": "<Translation>"
      ...more
    }
    ```

    Simply replace `<Label>` with the actual label and `<Translation>` with the corresponding translation.
*   **Configuration component for the 'Create Niet Natuurlijk Persoon Zaakrol' plugin action**

    The 'Create Niet Natuurlijk Persoon Zaakrol' plugin action under the Zaken API plugin now includes a front-end configuration component.
*   **Configuration component for the 'Set Zaakstatus' plugin action**

    The 'Set Zaakstatus' plugin action under the Zaken API plugin now includes a front-end configuration component.
*   **Configuration component for the 'Create Zaakresultaat' plugin action**

    The 'Create Zaakresultaat' plugin action under the Zaken API plugin now includes a front-end configuration component.
*   **Configuration component for the 'Besluiten API plugin**

    The Besluiten API plugin now includes a front-end configuration component.
*   **Configuration component for the 'Create Zaakbesluit' plugin action**

    The 'Create Zaakbesluit' plugin action under the Besluiten API plugin now includes a front-end configuration component.
*   **Valtimo frontend libraries version visible in settings menu**

    The 'Settings' menu now displays the version of the Valtimo Frontend libraries.

## Bugfixes

The following bugs were fixed:

*   **AssigneeFilter reset when opening case list**

    Fixed an issue where the wrong assigneeFilter is active and displaying the wrong case list because of it.
*   **Dropdown not working in Productaanvragen connector form**

    Dropdowns are now working in the create/edit form for the Productaanvragen connector.
*   **Custom List Column Date format**

    Fixed formatting not passed
*   **Custom List Column support definition key with dots in the name**

    Added support for dots in key

## Breaking changes

No breaking changes.

## Deprecations

No deprecations.

## Known issues

No known issues.
