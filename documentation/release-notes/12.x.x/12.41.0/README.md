# 12.41.0

## Migration

* [Backend migration](./back-end-migration.md)

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **Backend libraries are now published to S3 (Sonatype Central is being phased out)**

  From this version the Valtimo backend libraries are published to S3 in addition to Sonatype
  Central. Publishing to Sonatype Central stops on **10 August 2026**; releases published
  after that date are available only from S3 (versions already on Maven Central stay
  there), so consumers must add the S3 repository to their
  Gradle build before then. See [Backend migration](./back-end-migration.md) for
  the steps.

## Bugfixes

* New bugfix.
