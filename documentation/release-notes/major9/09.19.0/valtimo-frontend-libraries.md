# Valtimo frontend libraries (5.8.0)

## New Features

The following features were added:

*   **Digit only input**

    The `v-input` component exported from `@valtimo/user-interface` now supports a new type input: `'digitOnly'`. This option displays a text input field which only accepts numbers as input.
*   **Improved tooltips**

    Various tooltips for plugin configuration components have been added or improved.
* **Improved the select component of the @valtimo/user-interface library**
  *   **Background color change**

      The select component has been improved to follow the default input style and to visually indicate when a dropdown menu is enabled or disabled.

      The default `v-select` component's background style color appearance has been changed to white to add contrast and distinguish it from the disabled state.
*   **Added auto scrolling to modal**

    The `valtimo-modal` component now scrolls to the top when transitioning between form flow steps, and when switching pages in a Form.IO wizard.
*   **Added option to customize Left Sidebar width adjustment**

    The `valtimo-left-sidebar` component now supports the option to customize the **default**, **maximum** and **minimum** width values from the left side menu. Also added the default behavior of keeping the resized value manually when refreshing the page.

    The change is optional and made in the `environment.ts` file (see example below). If there is no change, the component will receive predefined values by default.

    **`environment.ts`**

    ```typescript
    export const environment: ValtimoConfig = { ...
    customLeftSidebar: {
        defaultMenuWidth: 200, //default value: 230
        maxMenuWidth: 300,     //default value: 330
        minMenuWidth: 100,     //default value: 120
      }
     }
    ```
*   **Case detail tab with zaakobjecten**

    Added a tab page with a dropdown to select an object type that is linked to the current case. After selecting this type, a list of objects is shown of this type. To include this tab, add it to the `tabsFactory` in your implementation:

    **`app.module.ts`**

    ```typescript
    import {
    DefaultTabs,
    ...
    DossierDetailTabZaakobjectenComponent,
    ...
    } from '@valtimo/dossier';

    ...

    export function tabsFactory() {
      return new Map<string, object>([
        ...
        [DefaultTabs.zaakobjecten, DossierDetailTabZaakobjectenComponent],
        ...
      ]);
    }
    ```

    For more information on how to customize case tabs, see [this page](broken-reference).
*   **Added session timeout prompt for Keycloak**

    When an implementation uses Keycloak as its authentication provider, a session timeout prompt is now shown if the refresh token expires in five minutes or less. This uses a new component - `v-prompt` - which has been added to the `@valtimo/user-interface` library. It shows a timer for when the session is to expire, and offers a logout action, and an action to continue the session, which automatically refreshes the access token. If no action is taken, the user is logged out when the timer runs out.
*   **Changed input border**

    The shadows on the borders of `v-table`, `v-input` and `v-select` components have been replaced by a gray border to improve the contrast with the background.

## Bugfixes

The following bugs were fixed:

*   **Refactor of case list component**

    In developing new features for the case list component, it was discovered that the component contained quite a few bugs which were hard to fix. It was decided to refactor the component using observables. The following should now work without bugs:

    * On case definition load: get pagination (including sorting) from local storage. If this does not exist, get default pagination and sorting from the environment file.
    * Go to the first page when typing in a search term or sequence number.
    * Switch to last available page on choosing a larger page size.
    * On switching case definitions, the page indicator shows the correct page number.
    * When switching case definitions, the correct cached sort state or default sort state is retrieved.
*   **Styling fix for the searchable dropdown component**

    The component `valtimo-searchable-dropdown`, exported by `@valtimo/components`, had styling issues locally. Its styling was conflicting with styling imported by [ng-multiselect-dropdown](https://www.npmjs.com/package/ng-multiselect-dropdown). Its class names have been made more specific in order to avoid these styling conflicts.
*   **Creating a process link with plugins will now only show plugin configurations with actions**

    The Form links Plugin page used to show all plugin configurations but some of those configurations turned out to be unusable because the Plugin does not support any actions. The action needs to be selected on the second step of the modal.

    To prevent this the modal will now only show plugin configurations that support actions
*   **Fix rotating blue stripe bug for loading animation**

    In the new design - `@valtimo/user-interface` - [ngx-skeleton-loader](https://www.npmjs.com/package/ngx-skeleton-loader) is used to display loading animations. The styling of this package conflicted with the styling imported by [@formio/angular](https://www.npmjs.com/package/@formio/angular). A change has been merged to `ngx-skeleton-loader` to resolve this styling conflict. This updated package is now included in the libraries.

## Breaking changes

No known breaking changes.

## Deprecations

No new deprecations.

## Known issues

This version has the following known issues:

*   **Rotating blue stripes**

    Certain pages could show rotating blue stripes while loading data. This will be fixed in a future update.
