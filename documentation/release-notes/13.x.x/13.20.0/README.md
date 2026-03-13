# 13.20.0

{% hint style="info" %}
**Release date 18-03-2026**
{% endhint %}

## Migration

* [Front-end migration](./front-end-migration.md)

## New Features

* **Teams**

  Teams are groups of users in Valtimo. They can be used to organize users and manage their access to resources.
  Teams can be used for case assignment and access control rules.

  More information about teams can be found [here](../../../features/teams/README.md).

## Enhancements

* **Secure /users endpoint with access control**

  A new access control resource type has been added `com.ritense.valtimo.contract.authentication.User`.

  This resource type allows for controlling access to user data through the `/api/v1/users/` API. The supported actions
  are:
    - `view`: Allows viewing details of a single user.
    - `view_list`: Allows viewing a list of users or searching for users.

## Bugfixes

* Cleaned up unused code for task notifications, solving an error about `email_notification_settings_days` that appeared
  once a day.
* **Replaced Carbon overflow menus with custom overflow components**

  The Carbon Design System overflow menu components have been replaced with custom-built overflow components throughout the application. The Carbon overflow menu had persistent issues with sizing, positioning, and lacked adequate support for custom panes and custom trigger elements. The new custom components resolve these limitations and provide a consistent, flexible overflow menu experience across the platform.

* **Secure /users endpoint with access control**

  A new access control resource type has been added `com.ritense.valtimo.contract.authentication.User`.

  This resource type allows for controlling access to user data through the `/api/v1/users/` API. The supported actions
  are:
  - `view`: Allows viewing details of a single user.
  - `view_list`: Allows viewing a list of users or searching for users.
  More information about access control for users can be found [here](../../../features/keycloak/access-control.md).

* **Deprecation of old user management methods**

  Several methods in `UserManagementService` and `UserResource` have been deprecated in favor of the new access-controlled methods. These will be removed in a future version.
* 
* **Fixed error when viewing audit events for cases created before 13.15.0**

  Opening the progress tab for a case that was created on an older version could result in an error. A database migration now automatically corrects the stored audit data on startup.

  {% hint style="warning" %}
  **Performance note:** This migration updates audit records that still use the old data format. On databases with a large number of audit records this can take a significant amount of time. If you prefer to run it during a maintenance window, you can execute the appropriate SQL below directly on your database **before** upgrading. The migration will then detect that no records need updating and complete instantly.
  {% endhint %}

  **PostgreSQL:**

  ```sql
  UPDATE audit_record
  SET audit_event = (
      jsonb_set(
          audit_event::jsonb #- '{definitionId,caseDefinitionId}',
          '{definitionId,blueprintId}',
          jsonb_build_object(
              'blueprintType', 'CASE',
              'blueprintKey', audit_event->'definitionId'->'caseDefinitionId'->>'key',
              'blueprintVersionTag', audit_event->'definitionId'->'caseDefinitionId'->>'versionTag'
          )
      )
  )::json
  WHERE audit_event::jsonb->'definitionId'->'caseDefinitionId' IS NOT NULL;
  ```

  **MySQL:**

  ```sql
  UPDATE audit_record
  SET audit_event = JSON_REMOVE(
      JSON_SET(
          audit_event,
          '$.definitionId.blueprintId',
          JSON_OBJECT(
              'blueprintType', 'CASE',
              'blueprintKey', JSON_UNQUOTE(JSON_EXTRACT(audit_event, '$.definitionId.caseDefinitionId.key')),
              'blueprintVersionTag', JSON_UNQUOTE(JSON_EXTRACT(audit_event, '$.definitionId.caseDefinitionId.versionTag'))
          )
      ),
      '$.definitionId.caseDefinitionId'
  )
  WHERE JSON_EXTRACT(audit_event, '$.definitionId.caseDefinitionId') IS NOT NULL;
  ```
