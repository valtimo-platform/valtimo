# Valtimo frontend libraries (5.10.0)

## New Features

The following features were added:

*   **Sorted processes in progress tab**

    The processes that are displayed in the progress tab are now sorted with active processes first.
*   **System processes** Processes can now be marked as a system process. System processes are processes that are critical to the functioning of Valtimo itself. When a process is marked as a system process it will be shown in the list of processes and when viewing a process. If the process is also marked as read-only it will not be editable from the frontend.

    More information about this feature can be found [here](../../../features/process/systemprocesses.md).
*   **Added environment property to set the supported filetypes for uploading a file**

    A new property `caseFileUploadAcceptedFiles` can be used in the environment file to whitelist the supported filetypes when trying to upload a file in the documents tab.

    The way to use this is to create a comma separated list of mime types or file extensions.

    Eg.: `image/*,application/pdf,.psd`
*   **New documents tab for Documenten API uploads**

    If `uploadProvider` is set to `UploadProvider.DOCUMENTEN_API` in the environment, a new documents tab is shown. This tab only allows one file upload at a time. On selecting a file, a modal opens with a form to input metadata for the Documenten API. For more information on how to configure Documenten API uploads, refer to [this page](../../../features/zgw/zgw-documents/upload-to-documenten-api-with-metadata.md).
*   **Link upload process to a case on case management page**

    If `uploadProvider` is set to `UploadProvider.DOCUMENTEN_API` in the environment, the upload process that is used for uploading files can be set on the admin page of a case definition.
*   **New datepicker component**

    Added a new date picker component to `@valtimo/user-interface`: `v-date-picker`. It is based on [flatpickr](https://flatpickr.js.org/). When using this component, see the [migration notes](migration.md) on how to upgrade.
*   **Added new plugin actions to Documenten API and Zaken API plugin**

    New actions have been added to the Documenten API and Zaken API plugins: **Link uploaded document to zaak** and **Save uploaded document** respectively. After these plugin actions have been selected, the user does not have to input any configuration data.

    For more information on these new plugin actions refer to [this page](../../../features/plugins/configure-documenten-api-plugin.md) for the Documenten API and [this page](../../../features/plugins/configure-zaken-api-plugin.md) for the Zaken API.
*   **Set file extensions that open directly in the browser**

    You can now add a new environment property `supportedDocumentFileTypesToViewInBrowser` to declare which files are opened in the browser. All the files that are not included will not open in the browser but instead will be directly downloaded.
*   **The style of the button in the v-prompt in @valtimo/user-interface can now be set**

    The `v-prompt in @valtimo/user-interface` can now include a `ButtonType` value for both the cancel and confirm button.

## Bugfixes

The following bugs were fixed:

*   **Documents from the document can not be viewed in a new tab in Firefox**

    Everytime you would open a file on Firefox you would be redirected to the `Dashboard page` and you would not be able to see or download the file. A global fix is applied to open a file correctly and if it fails for some reason it will be downloaded automatically.
*   **BodyText of the v-prompt in @valtimo/user-interface can now be set properly**

    The `v-prompt in @valtimo/user-interface` was always showing the bodyText of the keycloak refresh token prompt.
*   **Button styling is not set in the v-button in @valtimo/user-interface**

    The `v-button in @valtimo/user-interface` was not able to handle async values since it was not listening to any changes.

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

    In the front-end libraries version 5.10.0, a new datepicker component has been added to `@valtimo/user-interface`. This component has a dependency on `flatpickr`, however, this was not included in the dependencies of `@valtimo/user-interface`. This dependency has been added in [Valtimo frontend libraries 5.12.0](../09.23.0/valtimo-frontend-libraries.md).

    To fix this for now, add the latest version of `flatpickr` to the dependencies of the implementation by running `npm install flatpickr`. Also see the [migration notes](migration.md) on this topic.
