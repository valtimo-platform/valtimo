# Valtimo frontend libraries

## New Features

The following features were added:

*   **Add configuration component for 'Create Portaaltaak' plugin action**

    When the Portaaltaak plugin is configured, the plugin action 'Create Portaltaak' can now be linked to a BPMN user task on the process links page.
*   **Add configuration component for 'Create Zaak' plugin action**

    When the Zaken API plugin is configured, the plugin action 'Create Zaak' can now be linked to a BPMN service task on the process links page.
*   **Add configuration component for the 'Verzoek' plugin**

    The 'Verzoek' plugin can now be configured from the plugin management page. To support the adding of multiple Verzoek types, a new component has been added to the `@valtimo/user-interface` library: `v-multi-input-form`. This component allows the input of a template containing a `v-form` component, and allows multiple instances of this specified form template within another `v-form` component.
*   **Add configuration component for the 'Create Natuurlijk Persoon Zaakrol' plugin action**

    The 'Create Natuurlijk Persoon Zaakrol' plugin action under the Zaken API plugin now includes a front-end configuration component.

## Bugfixes

The following bugs were fixed:

*   **Fix task modal scroll**

    Fixed an issue where task modals could not scroll when the task form was larger than the vertical size of the screen.
*   **Fix IBM Carbon accent colors**

    Fixed an issue where Carbon button and tag components were not themed with the Ritense blue theme colors, but with the stock IBM blue instead. Refer to [this file](https://github.com/valtimo-platform/valtimo-frontend-libraries/blob/development/projects/valtimo/components/assets/css/carbon.scss) if you want to customize theme colors in your implementation. Includes your custom theme file at the end of the `styles` array in your implementation's `angular.json` instead of `carbon.scss` exported from `@valtimo/components`.
*   **Fix case list URL parameters**

    Query parameters in the URL on the case list page (concerning pagination and search) were retained when navigating to other pages inside the application.

## Breaking changes

No breaking changes.

## Deprecations

No new deprecations.

## Known issues

No new known issues.
