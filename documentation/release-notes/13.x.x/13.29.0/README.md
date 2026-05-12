# 13.29.0

{% hint style="info" %}
**Release date TBD**
{% endhint %}

## New Features

* **Zaak sync (per case definition)**

  A new "Zaak-synchronisatie" admin panel under `Admin > Cases > {Case name} > [ZGW]` configures how Valtimo
  propagates case changes to the linked zaak in the Zaken API, scoped per case definition. Two one-way
  synchronisations (Valtimo → Zaken API) are now available:
    - **Behandelaar sync** — when the dossier assignee changes, the linked zaak gets a behandelaar rol matching the
      assignee.
    - **Note sync** — Valtimo notes on the case are mirrored as `ZaakNotitie` on the linked zaak.

  See the [Zaak sync section](../../../features/case/zgw/zaken-api-sync.md) for details.

* **Reschedule active timer jobs via TimerService process bean**

  A new `timerService` process bean is available with `updateActiveTimers` methods that reschedule all active BPMN timer 
  jobs belonging to process instances with a given business key. An optional list of activity IDs can be supplied to limit 
  which timers are updated. Failed timer jobs (retries exhausted) are skipped automatically. The method returns the number 
  of timers rescheduled.
  See the [process beans documentation](../../../nog-een-plek-geven/reference/process-beans.md#timerservice) for usage examples.

## Enhancements

* **`noteEventListenerEnabled` and `noteSubject` removed from the Zaken API plugin**

  These two properties moved off the Zaken API plugin and onto the new per-case-definition Zaak sync
  configuration (renamed to `noteSyncEnabled` and `noteSubject` respectively). The plugin now only owns
  connection settings; per-case-definition policy lives in the new "Zaak-synchronisatie" panel.

  See the [Zaak sync section](../../../features/case/zgw/zaken-api-sync.md) for details.

## Bugfixes

