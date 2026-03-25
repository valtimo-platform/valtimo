# 13.22.0

## New Features

* **Batched outbox message publishing**

  The outbox `PollingPublisherService` now fetches and publishes messages in configurable batches (default: 10) instead
  of one-at-a-time. The `MessagePublisher` interface has a new `publishBatch` default method. Existing implementations
  inherit this without changes; publishers with native batch support can override it for optimal throughput.

* **Outbox circuit breaker**

  A Resilience4j circuit breaker stops outbox polling when the publisher fails repeatedly, and resumes with a single
  test message once the wait duration passes. Configurable via `valtimo.outbox.publisher.polling.circuit-breaker.*`.

* **Outbox publisher health indicator**

  Exposes circuit breaker state via `/actuator/health` under `outboxPublisher` when Spring Boot Actuator is on the
  classpath.

* **Suppress outbox for Object Management configurations**

  Object management configurations now support a `suppressOutbox` property. When set to `true`, configured object API 
  read flows for that configuration skip outbox message creation, reducing unnecessary writes for read-heavy integrations. 
  Defaults to `false`.

* **Pipelined RabbitMQ publisher confirms**

  `RabbitMessagePublisher` now sends all messages first, then awaits all confirms in parallel with a single batch-wide
  timeout.

## Bugfixes

* Fixed MySQL `findOutboxMessage` query missing `ORDER BY created_on ASC`.
* Fixed `RabbitMessagePublisher` null safety on publisher confirm result.
* Fixed deprecated SLF4J method calls in `OutboxLiquibaseRunner`.

## Deprecations

The following will be removed in 14.0:

* `OutboxMessageRepository.findOutboxMessage()` — use `findOutboxMessages(batchSize)`
* `ValtimoOutboxService.getOldestMessage()` — use `getOldestMessages(batchSize)`
* `ValtimoOutboxService.deleteMessage(id)` — use `deleteMessages(ids)`
