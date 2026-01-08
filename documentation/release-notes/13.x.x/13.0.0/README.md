# 13.0.0

## New Features

#### Case Definition

Valtimo 13 introduces the new **Case Definition** concept. A Case Definition describes everything the system needs to execute a business process from start to finish. It includes process models, forms for user tasks, decision tables, data definitions, and other configurations.

In previous versions of Valtimo, the **Document Definition** was the primary component for defining the data structure of a case. In Valtimo 13, the Document Definition remains present but is now part of a Case Definition. This shift makes the Case Definition the central component that consolidates all case-related configurations into a single, cohesive definition.

#### Versioning

Each Case Definition can have multiple versions. In Valtimo 13, the location and structure of the configuration files have changed to support versioning of the Case Definition.&#x20;

Worth mentioning is that **forms** and **zaaktype links**, which were not versioned in earlier releases, are now versioned through the Case Definition version. By versioning these elements, Valtimo 13 removes the need for making changes backwards compatible and prevents changed configuration causing errors in existing cases.

#### Draft Versions

Valtimo 13 introduces support for **Draft Versions** of Case Definitions. A draft version allows users to configure and test changes without impacting running processes or the active production environment. Draft versions also allow multiple changes to be made to separate parts of the case configuration, without saving a broken work-in-progress configuration.

Users can create a draft from any existing final version. While in draft mode, all elements of the Case Definition can be modified. Once the draft is complete and validated, it can be finalized, promoting it to a **Final Version**. Final versions are locked for editing and serve as stable, deployable configurations.

Key terms introduced in this release include:

* **Draft**: A work-in-progress configuration of a Case Definition.
* **Finalize**: The action to promote a draft to a final, immutable version.
* **Active**: Indicates the globally active version of a Case Definition used for all new cases in the system.

This new approach enables safer change management and simplifies the deployment of updated case processes across environments.

When working with Case Definitions, draft versions are fully editable, allowing the creation, removal, or update of any element such as processes, forms, decisions, or configurations. Once a Case Definition is finalized, it becomes read-only, meaning all details remain visible and processes or forms can still be opened, deployed, or exported, but no further modifications can be made. This ensures that finalized versions remain consistent and reliable across acceptance and production environments.

#### Server-Sent Events (SSE)

Valtimo 13 introduces support for **Server-Sent Events (SSE)**, enabling real-time updates in the user interface without requiring a page refresh.

The first implementation of SSE is available in the task list on the **case detail page**, where users will now see live updates as tasks change or progress. This enhancement improves usability and ensures that users always have the most up-to-date information while working on cases.

#### Camunda to Operaton

Valtimo 13 replaces **Camunda** as the BPMN engine with **Operaton**.

Operaton is a fork of Camunda and remains fully compatible with **Camunda 7.23**. This ensures that existing BPMN models and process configurations continue to work seamlessly.&#x20;

### Enhancements

#### Changes to the Admin Interface

In Valtimo 13, several changes have been made to the **admin interface** to improve usability and align it with the new Case Definition structure.

Processes, decision tables, forms, and task list configurations have been moved from separate menu items into tabs under the **Case Management** screen. This change provides a more unified and contextual view of all elements that belong to a specific Case Definition, making it easier for users to manage and navigate case configurations.

#### Minor changes

- Notifications from Toastr have been replaced with Carbon notifications.

#### Breaking change: now using Keycloak username

In Valtimo 12, Valtimo services were configured by default to use the Keycloak user ID.
This behavior could be overridden to use the Keycloak username by setting the environment variable
```shell
VALTIMO_OAUTH_IDENTIFIERFIELD=username  
```

Starting with Valtimo 13, Valtimo services always use the Keycloak username.
The property VALTIMO_OAUTH_IDENTIFIERFIELD has been removed.
The PBAC property `${currentUserIdentifier}` is now deprecated. Its advices to change to `${currentUsername}`, `${currentUserEmail}` or `${currentUserId}`

Starting with Valtimo 13:
- Valtimo services always use the Keycloak username.
- The `VALTIMO_OAUTH_IDENTIFIERFIELD` property has been removed.
PBAC Property Update
- The PBAC property `${currentUserIdentifier}` is now deprecated.
- It is recommended to migrate to one of the following:
  - `${currentUsername}`
  - `${currentUserEmail}`
  - `${currentUserId}`

#### Removed feature toggles for authorization

In minor releases of Valtimo 12, access control was introduced for three features: **ZGW documents**, **Object Management**, and **dashboards**. To maintain backward compatibility, these changes were initially guarded by feature toggles with non-breaking default values.

In Valtimo 13, these feature toggles have been removed, and access control is now **enabled by default** for all features. As a result, additional access control permissions may need to be configured when upgrading to Valtimo 13 to ensure full access to all functionality.

## Bugfixes

*  Fixed issue when "No form linked" warning displays after submitting a start form.
*  Fixed issue when custom components would not display inside a Form View Model.

