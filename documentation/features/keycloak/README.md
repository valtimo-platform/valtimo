# 🗝️ Keycloak

[Keycloak](https://www.keycloak.org/) is an open-source Identity and Access Management (IAM) solution. It provides
centralized user management, authentication, and role management. Valtimo uses Keycloak as its default IAM provider
to handle who can log in and what roles they have.

## Why Keycloak?

Keycloak is a proven, widely adopted IAM solution that is well suited for government and enterprise environments.
Using Keycloak with Valtimo offers several advantages:

* **Single Sign-On (SSO)** — Users log in once through Keycloak and gain access to Valtimo without needing separate
  credentials. Keycloak supports standard protocols like OpenID Connect and SAML, making it easy to integrate
  with existing identity infrastructure.
* **Centralized user management** — User accounts, credentials, and roles are managed in one place. Administrators
  can create, disable, and manage users directly in the Keycloak admin console without needing access to Valtimo's
  backend.
* **Identity federation** — Keycloak can connect to external identity providers such as Microsoft Entra ID
  (Azure AD), LDAP directories, or other SAML/OIDC providers. This means organizations can use their existing
  user directories instead of maintaining a separate set of accounts.
* **Role-based authentication** — Keycloak provides roles that are passed to Valtimo through JWT tokens. These roles
  are the foundation for Valtimo's [access control](../access-control/) system, which determines what a user
  can see and do in the application.

## How it works

When a user logs in to Valtimo, the following happens:

1. The user is redirected to Keycloak's login page.
2. Keycloak authenticates the user (against its own user store or a federated identity provider).
3. On successful login, Keycloak issues a [JWT token](https://jwt.io/introduction) that contains the user's
   identity and assigned roles.
4. Valtimo reads the roles from the JWT token and matches them against the permissions configured in
   [access control](../access-control/). This determines which cases, tasks, dashboards, and other resources
   the user can access.

{% hint style="info" %}
There is no security risk when a role exists in Keycloak but is not configured in Valtimo's access control.
By default, a user has no access to any resource. Access is only granted by explicitly configuring permissions for
a role in access control.
{% endhint %}

## Roles

Keycloak supports two types of roles that Valtimo can use:

* **Realm roles** — These are global roles within a Keycloak realm. They are used by default in Valtimo.
* **Client roles** — These are roles scoped to a specific Keycloak client. Valtimo can be configured to use client
  roles in addition to realm roles. This is useful when multiple applications share the same Keycloak realm and
  you want to keep role definitions separate per application.

Roles created in Keycloak must also be configured in Valtimo's [access control](../access-control/) to have any
effect. The role names in access control must exactly match the role names in Keycloak.

{% hint style="info" %}
For information on how to configure the connection between Valtimo and Keycloak, including how to enable client roles,
see [Configuring Keycloak](../../running-valtimo/application-configuration/configuring-keycloak.md).
{% endhint %}

## User management

Valtimo retrieves user information directly from Keycloak. This means that user accounts — including names, email
addresses, and role assignments — are managed in the Keycloak admin console. Valtimo does not have its own user
registration or user management screens; it relies on Keycloak as the single source of truth for user data.

Within Valtimo, users are visible in areas like case assignment, task assignment, and team membership. The list of
available users and their details is always fetched from Keycloak.

## Access control

Access to users in Valtimo can be restricted through access control. See the
[access control](access-control.md) page for the available resources and actions.
