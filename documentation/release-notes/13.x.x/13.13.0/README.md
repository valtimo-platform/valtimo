# 13.13.0

{% hint style="info" %}
**Release date 28-01-2026**
{% endhint %}

## Migration

* [Front-end migration](front-end-migration.md)

## New Features

* **Building blocks for reusable process steps**

  Building blocks let you package a reusable subprocess with its own data model and version it separately from cases.
  The same building block can be reused across multiple case definitions to keep shared steps consistent, while cases
  stay stable because they only exchange defined inputs and outputs with the building block. Building blocks can also
  be moved between environments by importing and exporting their definitions.
  
  Learn more in [Building blocks](../../../features/building-blocks/README.md).

* **IKO**

  IKO is a component designed to support service delivery by providing an integrated, up-to-date overview of customer (
  Klantbeeld) and object (Objectbeeld) data. It acts as an API gateway that aggregates information from multiple backend
  sources into a single unified response, enabling employees to assist citizens, businesses, and institutions more
  effectively and transparently.

  Learn more at Learn more at [IKO documentation](https://docs.integraal-klant-objectbeeld.nl/).


* **Setting case retention date**

  The _retention period_ is an internal status property that, when set, calculates the expiration date for the case.<br>When that date is reached, the case and all associated processes (including process history) will be deleted. If present, the case is also removed from connected ZGW platforms (for example, case details, objects, and uploaded documents).
  See [Internal status](../../../features/case/case-detail/statuses.md) for the configuration of the retention date.

  **Note:** when the case internal status is set where the retention period is set to -1, the retention date of the case will not be calculated or cleared when set.

## Enhancements

* **Widget configuration made available to custom component**

  To be able to access the widget configuration in a custom component it is now injected as `widgetConfiguration` when the custom component is created by the `custom-component` widget.

* **Zaken API - Changed required fields for Create Zaakrol plugin actions**

  Changed required fields for; Create Zaakrol - Employee, Create Zaakrol - Organisational unit and Create Zaakrol - Branch

* **Allow switching between process link steps**

  For existing process links, it is now possible to switch between the steps of its configuration in the process link
  modal.

## Bugfixes

* **Tasks are now no longer closed when another user changes the task assignee.**
* **LockProvider configuration now supports specifying the `timezone` via configuration properties and defaults to `UTC` if not specified.**
