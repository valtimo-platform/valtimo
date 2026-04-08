# 12.29.0

## New Features

* **Batched outbox publishing** — Messages are now fetched and published in configurable batches, improving throughput.

* **Outbox circuit breaker** — Automatically stops polling when the message broker is unavailable and resumes once connectivity is restored.

* **Outbox health indicator** — Exposes outbox publisher status via `/actuator/health`.

* **Suppress outbox for Object Management** — A `suppressOutbox` property can be set on object management configurations to skip outbox writes for read-heavy integrations.

* **Pipelined RabbitMQ confirms** — The RabbitMQ publisher now sends all confirmations in parallel instead of one-by-one.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* Fixed MySQL outbox message query missing ordering.
* Fixed RabbitMQ outbox publisher null safety on confirmation result.

## Deprecations

The following will be removed in 14.0:

* `OutboxMessageRepository.findOutboxMessage()` — use `findOutboxMessages(batchSize)`
* `ValtimoOutboxService.getOldestMessage()` — use `getOldestMessages(batchSize)`
* `ValtimoOutboxService.deleteMessage(id)` — use `deleteMessages(ids)`

## Known issues

This version has the following known issues:

* **Outbox circuit breaker never recovers from OPEN state**
  * Discovered in version 12.29.0
  * Fixed in 12.30.0. Workaround: Disable the circuit breaker using the `valtimo.outbox.publisher.polling.circuit-breaker.enabled` property.
