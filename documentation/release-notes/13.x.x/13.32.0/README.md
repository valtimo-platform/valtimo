# 13.32.0

{% hint style="info" %}
**Release date 10-06-2026**
{% endhint %}

## Features

## Bugfixes

## Enhancements

* **Gap-free widget layout**

  The widget layout algorithm has been replaced with a custom dense-packing algorithm. The previous Muuri
  `fillGaps` option could leave visible gaps between widgets of different sizes. The new algorithm sorts widgets by
  height descending and places each one at the first available position on a cell-based occupancy grid — similar to
  CSS Grid's `auto-flow: dense`. This produces a compact rectangular layout where gaps only appear at the bottom-right
  edge, never in the middle. The algorithm automatically detects grid dimensions from item sizes, so it works for both
  case widgets and dashboard widgets without any hardcoded constants.
