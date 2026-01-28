# 13.13.0

{% hint style="info" %}
**Release date xx-xx-2026**
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
