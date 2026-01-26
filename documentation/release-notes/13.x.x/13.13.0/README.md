# 13.13.0

{% hint style="info" %}
**Release date xx-xx-2026**
{% endhint %}

## New Features

* **Setting case retention date**

The _retention period_ is an internal status property that, when set, calculates the expiration date for the case.<br>When that date is reached, the case and all associated processes (including process history) will be deleted. If present, the case is also removed from connected ZGW platforms (for example, case details, objects, and uploaded documents).

See [Internal status](../../../features/case/case-detail/statuses.md) for the configuration of the retention date.

**Note:** when the case internal status is set where the retention period is set to -1, the retention date of the case will not be calculated or cleared when set.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* New bugfix.
