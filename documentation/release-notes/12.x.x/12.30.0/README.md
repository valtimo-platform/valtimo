# 12.30.0

## New Features

* **Cross-case message correlation**

  New `sendGlobalCatchEventMessage` and `sendGlobalCatchEventMessageToAll` methods on `correlationService` allow messages to be correlated to process instances across all cases, without requiring a business key. See [correlating messages](../../features/process/correlation-service.md) for details.

## Enhancements

* **Store large process variable strings**

  Process variables with String values exceeding 4000 characters are now stored as serialized Java objects instead of plain text, preventing data truncation in the Camunda variables table.

## Bugfixes

* Fixed outbox circuit breaker never recovering from OPEN state.
* Fixed deserialization of `beginRegistratie` in Documenten API responses
