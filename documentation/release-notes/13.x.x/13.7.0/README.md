# 13.7.0

{% hint style="info" %}
**Release date Day-Month - Year**
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
  
  See more about it [here](../../features/process/retry-cycle.md).

## Enhancement

* **Enhancement title**

  Enhancement description


## Bugfixes

* Resolved issue where there was no option to use current date/time in the set-zaakstatus action of the zaken-api-plugin.
* Resolved issue where the plugin modal form remained disabled after a failed plugin creation.
* Resolved issue where the Auto Key Input component did not correctly reset its value or the manual edit status.