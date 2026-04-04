# 13.23.0

{% hint style="info" %}
**Release date 08-04-2026**
{% endhint %}

## New Features

* **Added the Documenten API Preview plugin**

  The new "Documenten API Preview" plugin allows users to preview documents stored via the "Documenten API".
  Documentation on configuring the "Documenten API Preview" plugin can be found in the [Documenten API Preview plugin configuration guide](../../../features/zgw/zgw-plugins/configure-documenten-api-preview-plugin.md).

* **Publish notification plugin action for Notificaties API**

  A new plugin action "Publiceer een notificatie" has been added to the Notificaties API plugin. This action allows
  publishing notifications via the Notificaties API from a BPMN process, for example from a send task or intermediate
  throw event. 

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Security

* **Fixed SpEL injection vulnerability**

  `DocumentMigrationService` and `Condition` evaluated user-supplied SpEL expressions using `StandardEvaluationContext`, which grants unrestricted access to Java types and methods. An authenticated admin could exploit this to execute arbitrary OS commands, exfiltrate environment variables, or load arbitrary classes. Both classes now use `SimpleEvaluationContext`, which only allows property access and blocks type references, method invocation, and constructors.

## Bugfixes

* The case task list now loads significantly faster when building blocks are used.
