# 12.49.0

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* **Add configurable read timeout to Apache REST client customizer**

  A call to a slow Zaken or Objecten API now waits up to 180 seconds for an answer instead of giving up after a few seconds. Giving up early could leave a zaak behind without a case around it.
