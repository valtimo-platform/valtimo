# Migration

This page describes how to update Valtimo from the previous version to the current.

*   **Case settings**

    Scope: Back-end

    In order to support case settings, a new module was introduced. This is required for case settings to work, which front-end uses. Information on how to include this module can be found [here](../../../fundamentals/getting-started/modules/core/case.md).
*   **Added extra parameter to DocumentSearchService**

    Scope: backend

    Custom implementations of the `DocumentSearchService` now require `userManagementService` as a parameter in the super constructor. The `userManagementService` is a Spring bean and can be obtained in a similar fashion as all other constructor parameters. The constructor should look like this:

    ```java
    public MyCustomDocumentSearchService(
        EntityManager entityManager,
        QueryDialectHelper queryDialectHelper,
        SearchFieldService searchFieldService,
        UserManagementService userManagementService
    ) {
        super(entityManager, queryDialectHelper, searchFieldService, userManagementService);
        ...
    }
    ```
