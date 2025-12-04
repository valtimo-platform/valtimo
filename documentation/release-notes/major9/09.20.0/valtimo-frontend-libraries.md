# Valtimo frontend libraries (5.9.1)

## New Features

The following features were added:

*   **Experimental editing of DMN tables in ui**

    The list of decision tables on the admin page `Decision tables` now only shows the latest versions of each DMN table. If the user attempts to open an incompatible DMN table of version 1.1, it is automatically migrated to 1.3 and opened. If the user uploads a DMN table, the overview list of decision tables is now refreshed after uploading. If the feature toggle `experimentalDmnEditing` is enabled in the environment, the user is now redirected to a DMN editor, where it is possible to switch between versions, edit a version, and deploy a new version. Please refer to [this page](../../../running-valtimo/application-configuration/feature-toggles.md) for more information on how to enable feature toggles.

    This feature is experimental, please refer to the known issues before considering to enable it. To make this work, add the following to the `scripts` array in your `angular.json` file: `"node_modules/dmn-js/dist/dmn-modeler.development.js"`.
*   **Unlink process links**

    Process links that were saved, can now also be deleted. More information on unlinking process links can be found [here](/broken/pages/4opu4d3uXwVvlBVwKeCC).
*   **Option to configure extra tabs for object type**

    Added option to configure and display tabs by zaak object type, so user can see all relevant data in a separate tab.

    This configuration is done in `environment.ts` by adding one or more **definition name** that contains a list of the name of object types, as shown in the following example.

#### **`environment.ts`**

```typescript
export const environment: ValtimoConfig = { ...
  caseObjectTypes: {
    leningen: ['Boom', 'Straatverlichting']
  },
 }
```

For more information on how to configure extra tabs for object types, see [this page](../../../features/zgw/configure-tab-object-type.md).

## Bugfixes

The following bugs were fixed:

*   **Progress tab selectedProcessInstanceId not set if processDocumentInstances is empty**

    The progress tab expected at least one process was started and tried to set the following property `selectedProcessInstanceId`. If no process was started, this results in an error in the console. This has been fixed and an empty state has been added to show the user no process has been started yet.
*   **Start button in case detail overview hardcoded instead of a translation property**

    The button to start a (sub)process on the case detail overview was always hardcoded with the label `Start`. This has been replaced by a translation property `dossier.startSubProcess` which can now be overridden in any implementation. The default value in Valtimo is still `Start`.
*   **Clicking on a case from the case list goes to dashboard**

    Clicking on a case in the case list would redirect the user to the dashboard. This behaviour has been fixed. When the user now clicks on a case in the case list, he/she will be redirected to the case.

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
