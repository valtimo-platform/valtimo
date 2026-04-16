# 13.23.0

{% hint style="info" %}
**Release date 08-04-2026**
{% endhint %}

## Migration

* [Front-end migration](./front-end-migration.md)

## New Features

* **Form flow management for building blocks**

  Building blocks now support form flow definitions. Form flows can be created, edited, and deleted through the **Form flows** tab in building block
  management. They are also included automatically in building block imports and exports. For more information, see
  [Building block form flows](../../../features/building-blocks/form-flows.md).

* **Added the Documenten API Preview plugin**

  The new "Documenten API Preview" plugin allows users to preview documents stored via the "Documenten API".
  Documentation on configuring the "Documenten API Preview" plugin can be found in the [Documenten API Preview plugin configuration guide](../../../features/plugins/configure-documenten-api-preview-plugin.md).

* **Cross-case message correlation**

  New `sendGlobalCatchEventMessage` and `sendGlobalCatchEventMessageToAll` methods on `correlationService` allow messages to be correlated to process instances across all cases, without requiring a business key. See [correlating messages](../../../features/process/correlation-service.md) for details.

* **Teams**

  Teams are groups of users in Valtimo. They can be used to organize users and manage their access to resources.
  Teams can be used for case assignment and access control rules.

  More information about teams can be found [here](../../../features/teams/README.md).

* **Team cases tab in the case list**

  When the case handler option is enabled for a case type, a new "Team cases" tab is now available in the case list.
  This tab shows all cases assigned to teams that the current user belongs to, making it easy to find work relevant
  to the user's team without filtering through all cases.

  The tab is included by default alongside the existing "All cases", "My cases", and "Unassigned cases" tabs. Which
  tabs are visible can be configured via the `visibleCaseListTabs` setting in the Angular environment file. See
  [case list tab configuration](../../../features/case/configuration.md#configuring-visible-case-list-tabs) for details.

## Enhancements

* **Introduced support for strings exceeding 4000 characters in Operaton process variables**  
  Long strings are now serialized as Java objects to bypass the database column size limit, and are deserialized back to strings transparently.

## Security

* **Fixed SpEL injection vulnerability**

  `DocumentMigrationService` and `Condition` evaluated user-supplied SpEL expressions using `StandardEvaluationContext`, which grants unrestricted access to Java types and methods. An authenticated admin could exploit this to execute arbitrary OS commands, exfiltrate environment variables, or load arbitrary classes. Both classes now use `SimpleEvaluationContext`, which only allows property access and blocks type references, method invocation, and constructors.

* **Dependencies**

  Many dependencies have been updated to the latest minor / patch.

## Bugfixes

* Fixed outbox circuit breaker never recovering from OPEN state.
* The case task list now loads significantly faster when building blocks are used.
