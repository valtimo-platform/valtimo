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


* **Zaaktype dropdown now shows the begin and end date**

  The 'Gekoppeld zaak type' dropdown in the case type link configuration now shows the start and end
  date of each zaaktype between parentheses, next to its description. This makes it possible to tell
  apart different versions of zaaktypes that share the same description, preventing configuration
  mistakes.

* **Option to keep the form.io token out of localStorage**

  A new `disableFormioTokenInLocalStorage` feature toggle keeps the form.io token in memory only
  instead of persisting it to localStorage. It is disabled by default.

* **Backend libraries are now published to S3 (Sonatype Central is being phased out)**

  From this version the Valtimo backend libraries are published to S3 in addition to Sonatype
  Central. Publishing to Sonatype Central stops on **10 August 2026**; releases published
  after that date are available only from S3 (versions already on Maven Central stay
  there), so consumers must add the S3 repository to their
  Gradle build before then. See [Backend migration](./back-end-migration.md) for
  the steps.

* **Better logging for Notificatie API subscriptions**

  Creating, updating, and deleting a Notificatie API subscription ("abonnement") is now logged.
  Successful changes are logged at `INFO` level and failures at `WARN`/`ERROR` level including the
  reason, making it easier to trace subscription problems. When subscription registration is turned
  off (`valtimo.zgw.register-abonnementen=false`), this is now logged instead of happening silently.

## Bugfixes

* **Case list export now enforces the export permission**

  The case list CSV export endpoint (`POST /api/v1/case/{caseDefinitionKey}/export`) now checks the `export` permission
  before producing a file. A user without an applicable `export` permission for the case definition now receives a
  403 (Forbidden) response instead of an empty CSV.

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

* **Sorting on columns in the case list**
  
  When sorting the columns, the default sorting would not be respected in some cases.
  Additionally, when OpenSearch was used, sorting did not work. These issues have now been resolved.

* **Notificatie API subscriptions are now reliably (re)registered when plugin configuration changes**

  When a plugin that uses the Notificatie API (such as the Verzoek plugin) is added, changed, or
  removed, its subscription is now updated reliably. Previously the remote subscription could end up
  out of sync with the saved configuration, and failures went unnoticed.

* **Closing a dialog with the Esc key now works reliably**

  Pressing Esc now reliably closes the open dialog, even when you first clicked somewhere inside it
  that is not a button or input field. Previously the dialog could ignore Esc and had to be closed by
  refreshing the page.

## Security

* Addressed the reported security alerts. The `sigstore` dependency was updated to a fixed version. The remaining
  Angular alerts (hydration DOM clobbering, `HttpTransferCache` cache-key handling, and `formatDate` denial of
  service) were reviewed as non-exploitable in Valtimo's browser-only SPA and remain tracked for the next major
  Angular upgrade.
