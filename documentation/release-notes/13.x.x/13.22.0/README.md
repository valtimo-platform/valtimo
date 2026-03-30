# 13.22.0

{% hint style="info" %}
**Release date 01-04-2026**
{% endhint %}

## Migration

* [Front-end migration](./front-end-migration.md)

## New Features

* **Batched outbox publishing** — Messages are now fetched and published in configurable batches, improving throughput.

* **Outbox circuit breaker** — Automatically stops polling when the message broker is unavailable and resumes once connectivity is restored.

* **Outbox health indicator** — Exposes outbox publisher status via `/actuator/health`.

* **Suppress outbox for Object Management** — A `suppressOutbox` property can be set on object management configurations to skip outbox writes for read-heavy integrations.

* **Pipelined RabbitMQ confirms** — The RabbitMQ publisher now sends all confirmations in parallel instead of one-by-one.

* **Case definition-scoped access control permissions** - Permissions can now use `CaseDefinition` as a container condition. See [container conditions](../../features/access-control/container-conditions.md) for details.

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

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* **Replaced Carbon overflow menus with custom overflow components**

  The Carbon Design System overflow menu components have been replaced with custom-built overflow components throughout the application. The Carbon overflow menu had persistent issues with sizing, positioning, and lacked adequate support for custom panes and custom trigger elements. The new custom components resolve these limitations and provide a consistent, flexible overflow menu experience across the platform.

* Fixed sensitive data logging in inbox messages and null safety issues in SSE event mappers.
* Fixed MySQL outbox message query missing ordering.
* Fixed RabbitMQ outbox publisher null safety on confirmation result.

## Deprecations

The following will be removed in 14.0:

* `OutboxMessageRepository.findOutboxMessage()` — use `findOutboxMessages(batchSize)`
* `ValtimoOutboxService.getOldestMessage()` — use `getOldestMessages(batchSize)`
* `ValtimoOutboxService.deleteMessage(id)` — use `deleteMessages(ids)`
