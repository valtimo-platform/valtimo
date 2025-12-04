# Migration

This page describes how to update Valtimo from the previous version to the current.

*   **FormFieldDataResolver `get` method is deprecated**

    Scope: backend

    1.  **Implement the new `get` method**

        Add method `get(DataResolvingContext dataResolvingContext, String... varNames)` to your class and move the logic from the deprecated `get` to this new method. The parameters `String documentDefinitionName` and `UUID documentId` are moved to the `DataResolvingContext` object.
*   **New datepicker component flatpickr**

    Scope: frontend

    If this component is included anywhere in an implementation:

    1.  **Install flatpickr dependency**

        Run `npm install flatpickr` to install the dependency.

        When upgrading to [Valtimo frontend libraries 5.12.0](../09.23.0/valtimo-frontend-libraries.md) this is no longer necessary as the dependency is included in the libraries.
    2.  **Add style to angular.json**

        Add `"node_modules/flatpickr/dist/flatpickr.css"` to the styles array in `angular.json` to avoid issues.
