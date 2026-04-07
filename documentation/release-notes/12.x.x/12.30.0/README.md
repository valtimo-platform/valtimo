# 12.30.0

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **Store large process variable strings**

  Process variables with String values exceeding 4000 characters are now stored as serialized Java objects instead of plain text, preventing data truncation in the Camunda variables table.

## Bugfixes

* Fixed outbox circuit breaker never recovering from OPEN state.
* Fixed deserialization of `beginRegistratie` in Documenten API responses
