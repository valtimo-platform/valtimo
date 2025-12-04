# Migration

This page describes how to update Valtimo from the previous version to the current.

*   **Added extra parameter to KeycloakService**

    Scope: backend

    Custom implementations of the KeycloakService now require keycloakClientName as a parameter in the super constructor. Either set this value to an empty string (e.g. super(properties, "") or do the following:

    ```java
    public CustomKeycloakService(
        KeycloakSpringBootProperties properties,
        @Value("${valtimo.keycloak.client:}") String keycloakClientName
    ) {
        super(properties, keycloakClientName);
        this.properties = properties;
    }
    ```
