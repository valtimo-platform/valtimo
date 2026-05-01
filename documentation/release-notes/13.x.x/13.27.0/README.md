# 13.27.0

{% hint style="info" %}
**Release date 06-05-2026**
{% endhint %}

## New Features

* **Admin settings**

  A new admin settings page is available under the Admin menu for managing the application logo (light and dark mode,
  PNG or SVG) and toggling front-end feature flags at runtime. Changes take effect immediately in the current
  session; other sessions pick up the new values on their next page load. Both logos and feature toggle overrides support
  auto-deployment from classpath changeset files.
  See the [admin settings documentation](../../../features/admin-settings/README.md) for details and the
  [front-end migration guide](front-end-migration.md) for setup instructions.

* **Plugin configuration mapping on import**

  When importing a case definition that references plugin configurations from another environment, Valtimo now shows a
  preview of the required plugin configurations and allows administrators to map them to existing configurations in the
  target environment. This prevents broken process links after import and reduces manual configuration effort.
  Note: this requires the export to be created with Valtimo 13.25.0 or later, as earlier exports do not include the
  required plugin configuration metadata.
  See the [import and export section](../../../features/case/README.md#import) for more information.

## Enhancements

* **Dependency upgrades for CVE fixes**

  Upgraded Spring Boot and other dependencies to resolve several HIGH-severity CVEs.

## Bugfixes

* New bugfix.
