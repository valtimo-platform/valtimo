# 13.32.0

{% hint style="info" %}
**Release date 10-06-2026**
{% endhint %}

## Enhancements

* **Fewer gaps in widget layout**

  The widget layout algorithm has been replaced with a custom layout algorithm. The previous Muuri
  `fillGaps` option could leave visible gaps between widgets of different sizes. The new algorithm uses a two-phase
  approach — first assigning widgets to row-groups via span-descending partition matching, then placing them using a
  per-column height-map — to produce a compact layout with fewer gaps while preserving widget order as much as possible.
