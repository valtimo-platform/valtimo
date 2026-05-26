# 13.30.0

{% hint style="info" %}
**Release date 27-05-2026**
{% endhint %}

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* **Plugins in building block sub-processes now resolve correctly**

  When a building block's main process called another process inside the same building block via a call activity, plugins
  in that called process could fail to find their configured plugin instance. The plugin configuration is now resolved
  reliably in this scenario.
