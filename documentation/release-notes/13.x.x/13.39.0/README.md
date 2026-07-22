# 13.39.0

{% hint style="info" %}
**Release date 29-07-2026**
{% endhint %}

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

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
