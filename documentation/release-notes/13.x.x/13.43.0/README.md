# 13.43.0

{% hint style="info" %}
**Release date 26-08-2026**
{% endhint %}

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* **Tasks of cases that were already running before the upgrade to 13 can be opened again**

  Opening such a task could fail with an error when its form flow was shared by several case types before the
  upgrade, because the upgrade gives each case type its own copy and the task could no longer tell which copy
  to use. The case the task belongs to now decides.
