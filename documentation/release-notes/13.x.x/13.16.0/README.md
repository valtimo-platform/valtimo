# 13.16.0

{% hint style="info" %}
**Release date 18-02-2026**
{% endhint %}

## New Features

* **Added delete zaak resultaten action to zaken API plugin**

  The zaken API plugin now includes a new action called 'Delete zaak resultaten'. This action allows users to delete the results of a zaak.

* **Setting case retention date**

  The _retention period_ is a case status property that, when set, calculates the expiration date for the case.

  When that date is reached, the case and all associated processes (including process history) will be deleted. If
  present, the case is also removed from connected ZGW platforms (for example, case details, objects, and uploaded documents).

  See [Internal status](../../../features/case/case-detail/statuses.md) for the configuration of the retention date.

    +  **Note:** when the case status is set where the retention period is set to -1, no new retention date will be calculated, and any existing retention date will be cleared.


## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* New bugfix.
