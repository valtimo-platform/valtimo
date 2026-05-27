# 13.30.0

{% hint style="info" %}
**Release date 27-05-2026**
{% endhint %}

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **Extended create-zaak and patch-zaak plugin actions with full Zaken API spec properties**

  The `create-zaak` and `patch-zaak` Zaken API plugin actions now support all writable
  properties from the `POST /zaken` and `PATCH /zaken` OpenAPI spec, including
  identification, confidentiality, archive fields, verlenging, opschorting, processobject,
  related cases, products/services, and more.

  The plugin action configuration UI for both actions exposes all available properties via a
  dynamic add/remove interface with alphabetically sorted options and linked field groups for
  geometry, verlenging, opschorting, and processobject.

## Bugfixes

* **Plugins in building block sub-processes now resolve correctly**

  When a building block's main process called another process inside the same building block via a call activity, plugins
  in that called process could fail to find their configured plugin instance. The plugin configuration is now resolved
  reliably in this scenario.
