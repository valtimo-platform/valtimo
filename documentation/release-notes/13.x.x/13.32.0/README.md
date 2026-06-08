# 13.32.0

{% hint style="info" %}
**Release date 10-06-2026**
{% endhint %}

## Features

## Bugfixes

## Enhancements

* **Selectable widget layout algorithm**

  The algorithm used to arrange widgets can now be chosen per case widget tab, IKO tab and dashboard. Three options
  are available:

  * **Default (less gaps)** (`MUURI_GAP_FREE`) — Muuri masonry with gap filling. This is the original behaviour and is
    used when nothing is configured, so existing configurations are unaffected.
  * **Default** (`MUURI`) — plain Muuri masonry without gap filling.
  * **Gap free** (`BEAUTIFUL`) — a new custom dense-packing algorithm that may reorder widgets within a section to
    remove gaps, almost always producing a clean layout without holes.

  *Default* and *Default (less gaps)* keep the widgets in their configured order as much as possible but can leave
  empty space, while *Gap free* reorders widgets to eliminate gaps. The choice can be made in the admin UI (the
  dashboard edit modal, the case **Edit widget tab** modal and the IKO tab modal) and via auto-deployment through the
  optional `widgetLayout` property on the dashboard, case widget tab and IKO tab definitions. See the
  [dashboard](../../../features/dashboard/README.md#layout-algorithm),
  [case widget tab](../../../features/case/case-detail/tabs/widgets.md#layout-algorithm) and
  [IKO tab](../../../features/iko/tabs.md#layout-algorithm) documentation for details.
  
* **Access control overview tab**

  A new overview tab presents the permissions in a human-readable manner.

## Bugfixes
