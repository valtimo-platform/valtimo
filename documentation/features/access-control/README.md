# 🔏 Access control

Valtimo uses Policy Based Access Control (PBAC). It's a method of controlling access functions and data based on defined policies. Unlike role-based access control (RBAC), which relies on user roles, PBAC uses detailed policies to determine access rights.\
\
In PBAC, access rules are defined based on various attributes such as user identity, resource type, action being performed, and other contextual information. These policies can be very flexible and granular, allowing for precise control over who can access what.

{% hint style="info" %}
**Who and what?**\
In the area of _Access and Authentication,_ it is about defining who is allowed to do what. PBAC is about what somebody is allowed to do under certain conditions.
{% endhint %}

## Authentication

Valtimo makes use of OpenSource Keycloak to authenticate users. In order to gain access to Valtimo a user account needs to be created within Keycloak and have a valid username and password set. This can be directy in Keycloak or via external systems like Microsoft Entra, LDAP etc.

### Keycloak

Keycloak enables authentication by providing the option to create "Roles" that can be assigned to user accounts. These roles will be added to the user's [JWT token](https://jwt.io/introduction) once the user is authorized to access the application. Assigned roles can then be used to give or restrict access to functionality and data.

### Roles

Roles created in Keycloak also need to be configured in Access Control in order to create a link between the Keycloak roles and the configuration in Access Control. When logged in to Valtimo the assigned roles for a user are read from the [JWT token](https://jwt.io/introduction) together with the corresponding Access Control configurations for these roles. For that reason, it is important that the roles configured in Access Control exactly mirror the created roles in Keycloak.

{% hint style="info" %}
There is no security risk when a role that is available in Keycloak is not configured in Access Control. By default a Valtimo user will have no access. Only by configuring permissions for the Role in Access Control the appropriate access can be gained.
{% endhint %}

## Permissions

Permissions define whether a user with a specific role can access or act on the configured resource, when certain conditions are met.

Multiple permissions are evaluated as `OR`: The outcome of an authorization request is `true` when **any** of the permissions passes **all** the configured checks. When permissions are used to filter data from a list query, the result will contain every entry that passes the checks of **any** permission.

When selecting applicable permissions for evaluation, the following checks are performed:

* The user has the role that is configured for the permission.
* The requested resource matches the permission's resource.
* The required action matches the permission's action.
* The required context matches the permission's context. For example, a permission is only applicable in a certain case status.

## Conditions

Extra conditions can be applied to a permission to tighten the access to resources. These conditions are optional. Conditions are evaluated as `AND`, which means **all** configured conditions on a permission should evaluate to `true` to pass the permission checks.

Conditions can also be nested by using a container. This allows you to join another resource to the root resource, which you can add conditions to as well. An example of this can be found [here](configuring-conditions.md).

## When is access control applied?

Access control is always applied by default. This means that when a user requests a resource, the access control layer will check if the user has the required permissions to access the resource. To prevent certain actions from being checked by the access control layer, this needs to be explicitly configured. Tasks and listeners executed by BPMN models are not considered being accessed by a user, and therefore do not have access control applied to them.

The exception is user tasks. Since a user completes these tasks, access control is applied to them to verify the user is allowed to complete the task.
