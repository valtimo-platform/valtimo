# 12.34.0

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **Dependency upgrades for CVE fixes**

  Upgraded Spring Boot and other dependencies to resolve several HIGH-severity CVEs.

* **Task list columns**

  Task list columns can now also display the tags display type.

## Bugfixes

* **Recover from stuck migration locks**

  If an application instance was killed mid-migration, the migration lock could stay held and
  prevent other instances from starting. Valtimo now releases such stale locks automatically on
  startup and on graceful shutdown.
