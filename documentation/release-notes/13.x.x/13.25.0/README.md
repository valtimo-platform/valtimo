# 13.25.0

{% hint style="info" %}
**Release date 22-04-2026**
{% endhint %}

## New Features

  A new plugin action "Publiceer een notificatie" and "Ontvang een notificatie" have been added to the Notificaties API
  plugin. This action allows publishing and receiving notifications via the Notificaties API from a BPMN process.
  Documentation can be found in
  the [Notificaties API plugin configuration guide](../../../features/plugins/configure-notificaties-api-plugin.md).

  A new plugin action "Get audit trail" has been added to the Documenten API plugin. This action retrieves the audit
  trail for a document from the Documenten API and stores the result as a JSON string in a process variable, allowing
  BPMN processes to inspect who changed what on a document, when, and why. Documentation can be found in
  the [Documenten API plugin configuration guide](../../../features/plugins/configure-documenten-api-plugin.md).

## Bugfixes

* Fixed duplicate document definitions being created, which caused the error "Query did not return a unique result".