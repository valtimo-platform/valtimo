# 13.27.0

{% hint style="info" %}
**Release date 06-05-2026**
{% endhint %}

## New Features

* **Plugin configuration mapping on import**

  When importing a case definition that references plugin configurations from another environment, Valtimo now shows a
  preview of the required plugin configurations and allows administrators to map them to existing configurations in the
  target environment. This prevents broken process links after import and reduces manual configuration effort.
  Note: this requires the export to be created with Valtimo 13.25.0 or later, as earlier exports do not include the
  required plugin configuration metadata.
  See the [import and export section](../../../features/case/README.md#import) for more information.

* **Highlight widget**

  A new compact case-detail widget that emphasises a single value. The widget renders the value at a configured path;
  if the path resolves to an array, the number of items is shown instead. Highlight widgets are always rendered one
  column wide and support an accent colour, an optional icon and an action button (process or link), matching the
  styling of the other case-detail widgets. See the
  [widgets documentation](../../../features/case/case-detail/tabs/widgets.md) for configuration details.

## Enhancements

* **Dependency upgrades for CVE fixes**

  Upgraded Spring Boot and other dependencies to resolve several HIGH-severity CVEs.

## Bugfixes

* New bugfix.
