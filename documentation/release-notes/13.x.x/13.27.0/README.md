# 13.27.0

{% hint style="info" %}
**Release date 06-05-2026**
{% endhint %}

## New Features

* **Admin settings**

  A new admin settings page is available under the Admin menu for managing the application logo (light and dark mode,
  PNG or SVG), customizing the accent color palette, and toggling front-end feature flags at runtime. The accent colors
  section lets administrators override the ten CDS color levels (color 100 through color 10) with a color picker.
  Changes take effect immediately in the current session; other sessions pick up the new values on their next page load.
  Logos, accent colors, and feature toggle overrides can be auto-deployed from classpath resource files using the
  importer framework.
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

* **Task list columns**

  Task list columns can now also display the tags display type.

* **Aligned dependency versions with Spring Boot BOM**

  Updated Hibernate, MySQL driver, and Groovy to match the versions managed by the Spring Boot 3.5.14 BOM.

## Bugfixes

* Fixed BPMN diagram viewer pan and zoom not working on the Case details Progress tab and other diagram views.

* Sorting on document fields with type date, datetime, time,
  or number is now done numerically/chronologically instead of lexicographically.
