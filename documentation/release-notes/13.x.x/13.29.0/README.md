# 13.29.0

{% hint style="info" %}
**Release date 20-05-2026**
{% endhint %}

## New Features

* **Quick search for tasks**

  Quick search items have been added to the task list. Now, when filling in search values, they can be saved under a
  quick search item. When clicking on the item, the search will automatically be filled in and executed.

* **Reschedule active timer jobs via TimerService process bean**

  A new `timerService` process bean is available with `updateActiveTimers` methods that reschedule all active BPMN timer 
  jobs belonging to process instances with a given business key. An optional list of activity IDs can be supplied to limit 
  which timers are updated. Failed timer jobs (retries exhausted) are skipped automatically. The method returns the number 
  of timers rescheduled.
  See the [process beans documentation](../../../nog-een-plek-geven/reference/process-beans.md#timerservice) for usage examples.

## Enhancements

* **Dependency upgrades for CVE fixes**

  Upgraded dependency to resolve several CVEs.