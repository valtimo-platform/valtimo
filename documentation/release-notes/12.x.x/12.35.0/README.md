# 12.35.0

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* **Recover from stuck migration locks**

  If an application instance was killed mid-migration, the migration lock could stay held and
  prevent other instances from starting. Valtimo now releases such stale locks automatically on
  startup and on graceful shutdown.
