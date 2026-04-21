# 13.25.0

{% hint style="info" %}
**Release date 22-04-2026**
{% endhint %}

## New Features

* **Decision table support for building blocks**

  Building blocks can now have their own DMN decision tables. Decision tables can be deployed, edited, and deleted
  from the **Decision tables** tab in the building block management page. They can be used in business rule tasks
  within the building block's processes. Decision tables are included in building block import and export, and can be
  auto-deployed by placing `.dmn` files in the `config/building-block/<key>/<version>/dmn/` directory. See
  [Building block decision tables](../../features/building-blocks/decision-tables.md) for more information.

* **New Notificaties API plugin actions**
  
  A new plugin action "Publiceer een notificatie" and "Ontvang een notificatie" have been added to the Notificaties API
  plugin. This action allows publishing and receiving notifications via the Notificaties API from a BPMN process.
  Documentation can be found in
  the [Notificaties API plugin configuration guide](../../../features/plugins/configure-notificaties-api-plugin.md).

## Bugfixes

* Fixed Documenten API document preview not working for non-admin users.

* Fixed duplicate document definitions being created, which caused the error "Query did not return a unique result".
