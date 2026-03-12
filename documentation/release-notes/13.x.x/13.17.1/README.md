# 13.17.1

{% hint style="info" %}
**Release date 13-03-2026**
{% endhint %}

## Bugfixes

**Fixed error when viewing audit events for cases created before 13.15.0**

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
