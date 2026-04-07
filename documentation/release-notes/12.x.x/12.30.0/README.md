# 12.30.0

## New Features

* **Cross-case message correlation**

  New `sendGlobalCatchEventMessage` and `sendGlobalCatchEventMessageToAll` methods on `correlationService` allow messages to be correlated to process instances across all cases, without requiring a business key. See [correlating messages](../../features/process/correlation-service.md) for details.

## Enhancements

* **Introduced support for strings exceeding 4000 characters in Camunda process variables**  
  Long strings are now serialized as Java objects to bypass the database column size limit, and are deserialized back to strings transparently.

## Bugfixes

* Fixed outbox circuit breaker never recovering from OPEN state.
* Fixed deserialization of `beginRegistratie` in Documenten API responses
