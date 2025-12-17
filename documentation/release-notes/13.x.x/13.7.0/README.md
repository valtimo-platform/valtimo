# 13.7.0

{% hint style="info" %}
**Release date 10-12-2025**
{% endhint %}

## New Features

* **Retry cycles for failed jobs**

  Standard Retry cycles are defined which can be added to the following BPMN elements:
    * Tasks
    * Call Activities
    * Sub processes
    * Events

  There are three retry cycle options available: `DEFAULT`, `QUICK`, and `CRITICAL`.

  These retry cycles can be customized in application.yml.
  In addition, custom cycles can be defined through Spring Boot configuration files.

  See more about it [here](../../../features/process/retry-cycle.md).

* **Widget compact mode**

  During the configuration of the widgets, now a `Density` step appears under certain conditions.

  See more about it [here](../../../features/case/case-detail/tabs/widgets.md).

* **Retrieving besluit action added to Besluiten API plugin**

  A new action was added to the Besluiten API plugin that allows a besluit to be retrieved. More information can be
  found [here](../../../features/plugins/configure-besluiten-api-plugin.md).

## Bugfixes

* Resolved issue where there was no option to use current date/time in the set-zaakstatus action of the
  zaken-api-plugin.
* Resolved issue where the plugin modal form remained disabled after a failed plugin creation.
* Resolved issue where the Auto Key Input component did not correctly reset its value or the manual edit status.
* Resolved issue where the Choice Fields pagination was not working correctly.
