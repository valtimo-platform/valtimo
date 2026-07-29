# 12.41.0

## Migration

* [Backend migration](./back-end-migration.md)

## Enhancements

* **Backend libraries are now published to S3 (Sonatype Central is being phased out)**

  From this version the Valtimo backend libraries are published to S3 in addition to Sonatype
  Central. Publishing to Sonatype Central stops on **10 August 2026**; releases published
  after that date are available only from S3 (versions already on Maven Central stay
  there), so consumers must add the S3 repository to their
  Gradle build before then. See [Backend migration](./back-end-migration.md) for
  the steps.

## Bugfixes

* **Documents tab no longer fails when a linked document is missing in the Documenten API**

  Documents that are still linked to the zaak but no longer exist in the Documenten API are
  now skipped (with a warning in the log), so the remaining documents of the case are still
  shown instead of an error. Pagination of the documents tab also no longer fails when
  skipped documents leave a page beyond the end of the result set, and deleting a case no
  longer fails when one of its linked documents is missing in the Documenten API.
