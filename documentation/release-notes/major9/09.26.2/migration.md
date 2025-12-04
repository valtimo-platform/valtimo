# Migration

This page describes how to update Valtimo from the previous version to the current.

* **Change Swagger to OpenAPI**

  Scope: Front-end

  The `/v2/api-docs` has been replaced by `/v3/api-docs`. This new path should be set in the environment.ts:
  ```javascript
  swagger: {
    endpointUri: '/v3/api-docs'
  }
  ```

