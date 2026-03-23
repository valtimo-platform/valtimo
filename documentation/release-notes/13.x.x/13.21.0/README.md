# 13.21.0

{% hint style="info" %}
**Release date 25-03-2026**
{% endhint %}

## New Features

* **Check if a zaak is still active**

  A new API endpoint has been added to check whether a zaak is still active (i.e. its `einddatum` is not set). The endpoint looks up a zaak by its identificatie and returns whether it is active. Access is controlled through PBAC: a new `com.ritense.zakenapi.security.Zaak` resource type with the `view_active_status` action allows administrators to restrict which zaaktypen a user may query. See [Check zaak active status](../../../features/zgw/check-zaak-active-status.md) for details.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* Fixed a bug where building blocks could not update the internal case status, case tags, or assignee of the calling
  case. The building block now correctly references the case definition of the parent case.

* **Fixed auto-deployment of global forms and object management configurations**

  Forms used by object management (edit/view forms) could not be auto-deployed in Valtimo 13 because the form importer
  required a case definition context. Global forms can now be placed in `config/global/form/*.form.json` and object
  management configurations in `config/global/object-management/*.object-management.json` for automatic pickup on
  startup.
