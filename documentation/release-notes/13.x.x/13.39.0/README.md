# 13.39.0

{% hint style="info" %}
**Release date 29-07-2026**
{% endhint %}

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

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

* **Notificatie API subscriptions are now reliably (re)registered when plugin configuration changes**

  When a plugin that uses the Notificatie API (such as the Verzoek plugin) is added, changed, or
  removed, its subscription is now updated reliably. Previously the remote subscription could end up
  out of sync with the saved configuration, and failures went unnoticed.

## Security

* Addressed the reported security alerts. The `sigstore` dependency was updated to a fixed version. The remaining
  Angular alerts (hydration DOM clobbering, `HttpTransferCache` cache-key handling, and `formatDate` denial of
  service) were reviewed as non-exploitable in Valtimo's browser-only SPA and remain tracked for the next major
  Angular upgrade.
