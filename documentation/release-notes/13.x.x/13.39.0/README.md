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

* **Better logging for Notificatie API subscriptions**

  Creating, updating, and deleting a Notificatie API subscription ("abonnement") is now logged.
  Successful changes are logged at `INFO` level and failures at `WARN`/`ERROR` level including the
  reason, making it easier to trace subscription problems. When subscription registration is turned
  off (`valtimo.zgw.register-abonnementen=false`), this is now logged instead of happening silently.

* **Case detail keeps the status and assignee up to date automatically**

  The case detail screen now updates the internal status and the assignee on its own as soon as they
  change, so you no longer have to switch tabs or reload the page to see the current situation. This
  happens for example when a status changes automatically because a task is completed or a timer
  expires, and when a case is assigned to — or unassigned from — a colleague or a team.

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

* **Case definition name entered when creating a draft version is now saved**

  The *Case definition name* filled in when creating a draft version based on an existing version is now saved on
  the new draft. Previously it was discarded and the draft kept the name of the version it was based on.

* **Case management screens now show the name of the selected version**

  The page title and breadcrumb now show the case definition name of the version you have selected. Previously the
  title used the title from the document definition and the breadcrumb the name of the globally active version, so a
  changed name was not visible. The breadcrumb also no longer stays behind after leaving version management.

* **Case menu and version indicator now update when a version is made globally active**

  Making a version globally active now updates the case menu and the *set as globally active* action immediately.
  Previously the menu kept showing the previously active version and its name until the page was reloaded.

* **Expanded menu groups stay open when the menu refreshes**

  An expanded menu group such as *Cases* now stays open when the menu refreshes its contents, for example after
  uploading a case definition. Previously the group collapsed.

## Security

* Addressed the reported security alerts. The `sigstore` dependency was updated to a fixed version. The remaining
  Angular alerts (hydration DOM clobbering, `HttpTransferCache` cache-key handling, and `formatDate` denial of
  service) were reviewed as non-exploitable in Valtimo's browser-only SPA and remain tracked for the next major
  Angular upgrade.
