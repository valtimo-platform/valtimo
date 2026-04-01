# 13.22.0

{% hint style="info" %}
**Release date 01-04-2026**
{% endhint %}

## New Features

* **Batched outbox publishing** — Messages are now fetched and published in configurable batches, improving throughput.

* **Outbox circuit breaker** — Automatically stops polling when the message broker is unavailable and resumes once connectivity is restored.

* **Outbox health indicator** — Exposes outbox publisher status via `/actuator/health`.

* **Suppress outbox for Object Management** — A `suppressOutbox` property can be set on object management configurations to skip outbox writes for read-heavy integrations.

* **Pipelined RabbitMQ confirms** — The RabbitMQ publisher now sends all confirmations in parallel instead of one-by-one.

* **Case definition-scoped access control permissions** - Permissions can now use `CaseDefinition` as a container condition. See [container conditions](../../features/access-control/container-conditions.md) for details.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* Fixed sensitive data logging in inbox messages and null safety issues in SSE event mappers.
* Fixed MySQL outbox message query missing ordering.
* Fixed RabbitMQ outbox publisher null safety on confirmation result.

## Deprecations

The following will be removed in 14.0:

* `OutboxMessageRepository.findOutboxMessage()` — use `findOutboxMessages(batchSize)`
* `ValtimoOutboxService.getOldestMessage()` — use `getOldestMessages(batchSize)`
* `ValtimoOutboxService.deleteMessage(id)` — use `deleteMessages(ids)`
