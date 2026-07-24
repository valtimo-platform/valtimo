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

* **Closing a modal with the ESC key now works reliably**

  Pressing the ESC key now closes the top-most open modal through the same handling as the close (X)
  button, regardless of where keyboard focus is. Previously ESC only closed a modal while focus was
  inside it, so pressing ESC after clicking a non-focusable part of the modal — or right after
  opening in development builds — did nothing. When a Carbon dropdown or combo-box inside the modal
  is open, the first ESC closes only that menu and leaves the modal open; a second ESC then closes
  the modal.

* **Several modals were missing shared modal behaviour**

  A number of modals did not wire up the shared `valtimoCdsModal` behaviour, so they missed the
  background scroll lock, content sizing, close-button tooltip suppression and the ESC-to-close
  handling. This affected, among others, the ZGW "Connected zaak type" configuration, the Documenten
  API column/upload-field/tag modals, the process, form and building block upload modals, the widget
  management modals, the decision deploy modal and the access control role modals. These modals now
  behave consistently with the rest of the application.

