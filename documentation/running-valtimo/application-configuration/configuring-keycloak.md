# Configuring Keycloak

Keycloak is the default authentication provider for Valtimo. It is used to authenticate users, and Valtimo can retrieve information about users and roles from Keycloak.

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
SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_JWK-SET-URI=https://keycloak.example.com/auth/realms/valtimo/protocol/openid-connect/certs
SPRING_SECURITY_OAUTH2_CLIENT_PROVIDER_KEYCLOAKAPI_ISSUER-URI=https://keycloak.example.com/auth/realms/valtimo
SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_KEYCLOAKAPI_CLIENT-ID=valtimo-user-m2m-client
SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_KEYCLOAKAPI_CLIENT-SECRET=0000000-1111-2222-3333-444444444444
```

More information about these properties and other optional properties can be found [here](https://docs.spring.io/spring-security/reference/servlet/oauth2/login/core.html).

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
SPRING_SECURITY_OAUTH2_CLIENT_PROVIDER_KEYCLOAKJWT_ISSUER-URI=https://keycloak.example.com/auth/realms/valtimo
SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_KEYCLOAKJWT_CLIENT-ID=valtimo-console
```
