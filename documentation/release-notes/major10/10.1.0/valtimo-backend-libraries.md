# Valtimo backend libraries

## New Features

The following features were added:

*   **Form flow bean for completing an associated task**

    A bean for Form Flow was added to make it easier to complete a Camunda user task from within a Form Flow. More information can be found [here](/broken/pages/gfMF9k7Wj1jYJeTeiKq5#form-flow-spel-beans)
*   **Form flow instance creation on task open**

    The Form flow instance is now created when a user task is opened. Users configuring the form flow can now make changes to the form flow that is connected to the user task, as long as the task isn't opened.
*   **Form flow context contains extra variable**

    A variable called `instance.id` has been added to the SpEL context of a form flow expression. This variable contains the id of a form flow instance. More information can be found [here](/broken/pages/gfMF9k7Wj1jYJeTeiKq5#available-properties-in-spel-context)
*   **Form flow conditional next step**

    A next step in a form flow can now be conditional. This allows for more complex form flows. For this feature, the submission data type has been changed. This makes it possible to directly access the submission data inside the SpEL expression of the next step condition. More information can be found [here](/broken/pages/IS3fUCisHvoPfR7PEa1o)
*   **Search field path validation**

    A user that is configuring a SearchField will now get a validation error when the `path` field of a search field does not point to a property inside the document.

## Bugfixes

No bugfixes.

## Breaking changes

The following breaking changes were introduced:

* **Form flow submission data type has been changed**

Instructions on how to migrate to this version of Valtimo can be found [here](migration.md).

## Deprecations

No new deprecations.

## Known issues

No new known issues.
