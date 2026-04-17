# 13.25.0

{% hint style="info" %}
**Release date 22-04-2026**
{% endhint %}

## New Features

* **Plugin configuration mapping on import**

  When importing a case definition that references plugin configurations from another environment, Valtimo now shows a
  preview of the required plugin configurations and allows administrators to map them to existing configurations in the
  target environment. This prevents broken process links after import and reduces manual configuration effort.
  Note: this requires the export to be created with Valtimo 13.25.0 or later, as earlier exports do not include the
  required plugin configuration metadata.
  See the [import and export section](../../../features/case/README.md#import) for more information.

* **Notificaties API plugin actions**

  A new plugin action "Publiceer een notificatie" and "Ontvang een notificatie" have been added to the Notificaties API
  plugin. This action allows publishing and receiving notifications via the Notificaties API from a BPMN process.
  Documentation can be found in
  the [Notificaties API plugin configuration guide](../../../features/plugins/configure-notificaties-api-plugin.md).

## Bugfixes

* Fixed duplicate document definitions being created, which caused the error "Query did not return a unique result".