# Migration

This page describes how to update Valtimo from the previous version to the current.

*   **Migrate getTaskProcessLink()**

    Scope: front-end

    1.  **Find and replace getTaskProcessLink()**

        Find all occurrences of `TaskService.getTaskProcessLink()` in your frontend project and replace them with `TaskService.getTaskProcessLinkV1()`.
