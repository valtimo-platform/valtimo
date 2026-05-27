# 13.30.0

{% hint style="info" %}
**Release date 27-05-2026**
{% endhint %}

## New Features

* **Reschedule active timer jobs via TimerService process bean**

  A new `timerService` process bean is available with `updateActiveTimers` methods that reschedule all active BPMN timer
  jobs belonging to process instances with a given business key. An optional list of activity IDs can be supplied to limit
  which timers are updated. Failed timer jobs (retries exhausted) are skipped automatically. The method returns the number
  of timers rescheduled.
  See the [process beans documentation](../../../nog-een-plek-geven/reference/process-beans.md#timerservice) for usage examples.

## Enhancements

* **Extended create-zaak and patch-zaak plugin actions with full Zaken API spec properties**

  The `create-zaak` and `patch-zaak` Zaken API plugin actions now support all writable
  properties from the `POST /zaken` and `PATCH /zaken` OpenAPI spec, including
  identification, confidentiality, archive fields, verlenging, opschorting, processobject,
  related cases, products/services, and more.

  The plugin action configuration UI for both actions exposes all available properties via a
  dynamic add/remove interface with alphabetically sorted options and linked field groups for
  geometry, verlenging, opschorting, and processobject.

## Bugfixes

* **Plugins in building block sub-processes now resolve correctly**

  When a building block's main process called another process inside the same building block via a call activity, plugins
  in that called process could fail to find their configured plugin instance. The plugin configuration is now resolved
  reliably in this scenario.
