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

* **Quick search for tasks**

  Quick search items have been added to the task list. Now, when filling in search values, they can be saved under a quick search item. When clicking on the item, the search will automatically be filled in and executed.

## Enhancements

* **Dependency upgrades for CVE fixes**

  Upgraded Spring Boot and other dependencies to resolve several HIGH-severity CVEs.

## Bugfixes

* New bugfix.
