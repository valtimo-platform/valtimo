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

* **Process links no longer leak into another case definition or building block**

  When the same process is deployed again, its process links are carried forward so that a new version of the process
  keeps them. That carry-forward only looked at the process definition key, so a link belonging to one case
  definition or building block also landed on the deployment of another case definition or building block that
  happened to use the same process definition key.
