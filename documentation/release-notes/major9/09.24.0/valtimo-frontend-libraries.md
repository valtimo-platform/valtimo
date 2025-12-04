# Valtimo frontend libraries (5.13.0)

## New Features

The following features were added:

*   **Added link to assign assignee to case**

    On the case details page, a button has been added to the header to add, change, or remove a case assignee.

    A drop-down list with the names of all available candidates will be displayed when clicking on this button. The selected candidate will be assigned to the case, and shown in the header.

    To unassign an assignee from a case, click on the 'remove' button present next to the label with the name.
*   **Default Language Setting**

    A new (optional) environment property `langKey` has been added to set the default language. The new property is an enum and includes the following values: `Language.NL`, `Language.EN` and `Language.DE`.

    The default language is used for every user that has not set a preferred language. If no language is set in the `environment.ts` the default is set to `Language.NL`.
*   **Valtimo list action callback**

    A new `$event` parameter has been added to the action callback from the valtimo list component.

    You can use this parameter to call `$event.stopPropagation()` to stop the row click listener being triggered when using actions.

## Bugfixes

No bugfixes.

## Breaking changes

No breaking changes.

## Deprecations

No new deprecations.

## Known issues

No new known issues.
