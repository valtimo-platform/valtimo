# Migration

This page describes how to update Valtimo from the previous to this version.

*   **FormFieldDataResolver supports method**

    Scope: backend

    A new supports method `supports(String externalFormFieldType)` replaces the already existing `supports(ExternalFormFieldType externalFormFieldType)` method for the `FormFieldDataResolver` interface.

    1.  **Replace uses of old method with new method**

        If the old method was used, the new method can be used by converting the existing argument to a string.
    2.  **Implement new supports method**

        For classes implementing the `FormFieldDataResolver` interface, the new method should be implemented.
*   **Changed ExternalDataSubmittedEvent data field type**

    Scope: backend

    The `data` field for the `ExternalDataSubmittedEvent` has changed from `Map<ExternalFormFieldType, Map<String, Object>>` to `Map<String, Map<String, Object>>`.

    1.  **Replace use of the old Map to the new type**

        if an `ExternalDataSubmittedEvent` is created, the Map should now be created with the `.toString()` method on the `ExternalFormFieldType`.
