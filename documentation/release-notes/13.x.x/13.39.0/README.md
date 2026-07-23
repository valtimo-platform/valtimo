# 13.39.0

{% hint style="info" %}
**Release date 29-07-2026**
{% endhint %}

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

* **Tooltips no longer stay on screen when the hovered element is removed**

  A tooltip shown for an element that was removed or re-rendered while hovered (for example on pages that
  refresh their data periodically, such as the OpenSearch reindex overview) stayed visible on screen
  permanently. The tooltip is now cleaned up together with its element.

* **List rows keep their state during periodic data refreshes**

  Lists that refresh their data periodically re-created their rows on every refresh, causing expanded rows,
  tooltips and hover state to flicker or reset. Rows with a stable identity (such as lists using an expanded
  row key) are now updated in place, so the view stays stable while the data refreshes.

* **Consistent Dutch terminology for cases**

  Several Dutch interface texts used *zaak* where the standard term *dossier* applies, among others in the
  OpenSearch and generic case list feature toggles, case statuses and tags, retention settings, the metroline
  widget and access control. These texts now consistently use *dossier*. Dutch ZGW-related terms (such as
  *zaaktype* and *zaaknummer*) are unchanged.
