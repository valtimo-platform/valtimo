# Configuring Keycloak

Keycloak is the default authentication provider for Valtimo. It is used to authenticate users, and Valtimo can retrieve information about users and roles from Keycloak.

## Session timeouts

The recommended Valtimo settings are:

* **SSO Session Idle:** 30 minutes
* **SSO Session Max:** 10 hours
* **Access Token Lifespan:** 5 minutes

### How to check or change these values

1. Log in to the Keycloak admin console.
2. In the top-left menu, click **Manage realms**.
3. Select the **valtimo** realm or any other realm you want to configure.
4. In the left menu, click **Realm settings**.
5. Click the **Sessions** tab.
6. Check that **SSO Session Idle** is set to **30 minutes** and **SSO Session Max** is set to **10 hours**.
7. If you changed anything, click **Save** at the bottom.
8. Click the **Tokens** tab.
9. Check that **Access Token Lifespan** is set to **5 minutes**.
10. If you changed anything, click **Save** at the bottom.

### What this does

* If a user does nothing in the application for 30 minutes, they are automatically logged out.
* A user is shown a "your session is about to expire" prompt 5 minutes before logout, so they can extend it.
* Even with continuous use, a single login session lasts at most 10 hours before requiring a new login.

## Logging out and refresh tokens

The recommended Valtimo setting is:

* **Revoke Refresh Token:** ON

### How to check or change this

1. Log in to the Keycloak admin console.
2. In the top-left menu, click **Manage realms**.
3. Select the **valtimo** realm or any other realm you want to configure.
4. In the left menu, click **Realm settings**.
5. Click the **Tokens** tab.
6. Find **Revoke Refresh Token** and make sure the toggle is **ON**.
7. If you changed anything, click **Save** at the bottom.

### What this does

When a user logs out, this setting ensures their session cannot be silently reused. After logout, the user must log in
again to access Valtimo.

Note: for up to 5 minutes after logout, an already-issued token may still work for direct API calls. This is expected
and matches the **Access Token Lifespan** setting above. If your environment requires a shorter window, lower the
**Access Token Lifespan** value (this will cause users' browsers to refresh tokens more often).

## Properties for connecting to Keycloak

In order for Valtimo to connect to Keycloak, certain properties are necessary. There are two different location in which these properties can be placed.

The properties can be placed in the `application.yml`:

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          jwk-set-uri: https://keycloak.example.com/auth/realms/valtimo/protocol/openid-connect/certs
      client:
        provider:
          keycloakapi:
            issuer-uri: https://keycloak.example.com/auth/realms/valtimo
        registration:
          keycloakapi:
            client-id: valtimo-user-m2m-client
            client-secret: # Configured elsewhere
            authorization-grant-type: authorization_code
            scope: openid
```

Or as an environment variable:

```properties
SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_JWK_SET_URI=https://keycloak.example.com/auth/realms/valtimo/protocol/openid-connect/certs
SPRING_SECURITY_OAUTH2_CLIENT_PROVIDER_KEYCLOAKAPI_ISSUER_URI=https://keycloak.example.com/auth/realms/valtimo
SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_KEYCLOAKAPI_CLIENT_ID=valtimo-user-m2m-client
SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_KEYCLOAKAPI_CLIENT_SECRET=0000000-1111-2222-3333-444444444444
```

More information about these properties and other optional properties can be found in the [Spring Security OAuth2 documentation](https://docs.spring.io/spring-security/reference/servlet/oauth2/login/core.html).

## Client roles

By default, Valtimo uses Keycloak _realm_ roles. But Valtimo can be configured to also use the Keycloak _client_ roles. To make use of Keycloak client roles together with the realm roles, the following property is needed:

```yaml
valtimo:
 spring:
  security:
    oauth2:
      client:
        provider:
          keycloakjwt:
            issuer-uri: https://keycloak.example.com/auth/realms/valtimo
        registration:
          keycloakjwt:
            client-id: valtimo-console
```

or

```properties
SPRING_SECURITY_OAUTH2_CLIENT_PROVIDER_KEYCLOAKJWT_ISSUER_URI=https://keycloak.example.com/auth/realms/valtimo
SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_KEYCLOAKJWT_CLIENT_ID=valtimo-console
```
