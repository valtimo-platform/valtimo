# Valtimo frontend libraries

## New Features

The following features were added:

*   **Dashboard**

    The dashboard module has been added to support the new dashboard.

    * Information on how to include this module can be found [here](../../../fundamentals/getting-started/modules/core/dashboard.md).
    * Information on how to configure a dashboard can be found [here](../../../features/dashboard/).
    * Information on how to implement custom display types and datasources can be found [here](../../../features/dashboard/dashboard-1/).
*   **Added edit note and delete note options on the notes tab**

    Added the functionality to edit and delete a note in an order. It can only be edited if the text field is not empty.
*   **Automatic User Task assignment to Case Handler**

    An additional checkbox has been added to the case assignee section of a case configuration that enables the user to toggle on and off the automatic assignment of user tasks to a case handler if a case has one assigned to it/is claimed by one.\
    Refer [to this page](broken-reference) to learn more about this feature.
*   **Carbon breadcrumbs and page title**

    New breadcrumbs and page titles have been introduced throughout the application, in order to provide a consistent user experience with Carbon components. Since previously URLs and breadcrumbs were not implemented consistently, some logic had to be introduced in order to provide proper breadcrumbs. How this was implemented, and how to use this logic in your implementation, is explained on [this page](../../../nog-een-plek-geven/reference/user-interface/breadcrumbs.md).
*   **Open menu items in new tab**

    With the release of Valtimo front-end libraries major 10, right-clicking on menu items in the left sidebar and opening them in a new tab, was no longer supported. This functionality has been restored in this release. Moreover, menu items can be opened in a new tab by holding down the control key on Windows, or the command key on Mac OS, and clicking them.
*   **New featureToggle 'hideValtimoVersionsForNonAdmins'**

    We have added a new featureToggle, 'hideValtimoVersionsForNonAdmins', so we can choose to hide the Valtimo version information, in the right sidebar, for users that are not admins.

## Bugfixes

No bugfixes.

## Breaking changes

No breaking changes.

## Deprecations

No deprecations.

## Known issues

This version has the following known issues:

*   **Error when installing latest version of `ng-multiselect-dropdown`**

    Recently, a new version of `ng-multiselect-dropdown` has been released. This is a dependency of `@valtimo/components`, and this new version is automatically installed. The version of this dependency has been corrected in this release. For previous release of Valtimo front-end libraries, add the following to the root of your `package.json` to correct the error.

#### **`package.json`**

```json
{
  ...
  "overrides": {
    "@valtimo/components": {
      "ng-multiselect-dropdown": "1.0.0-beta.19"
    }
  },
  ...
}
```

After adding this, it might be necessary to completely delete the `node_modules` folder and `package-lock.json` before performing a new install of dependencies and build. It is most effective to do this with the commands `rm -Rf node_modules` and `rm -Rf package-lock.json`. Also, it might be necessary to clean your NPM cache through `npm cache clean`.
