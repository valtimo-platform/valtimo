# 13.28.0

{% hint style="info" %}
**Release date 13-05-2026**
{% endhint %}

## New Features

* **Dutch address support in map widgets**

  The map widget can now render a layer that points at a Dutch address object instead of a GeoJSON geometry. Valtimo
  geocodes the address to a WGS84 coordinate via
  the [PDOK Locatieserver](https://api.pdok.nl/bzk/locatieserver/search/v3_1/ui/) and renders the result as a `Point`.
  See the [Map widget documentation](../../../features/case/tabs/widgets.md) for the full list of recognised fields and
  a configuration example.

## Enhancements

* **Persistent page sizes per case definition for task list and case list**

  When a user configures the page size for a case definition, either for the task or case list, this is remembered.
  Next time they visit the task or case list for that case definition, the same page size is shown.

## Bugfixes

* New bugfix.
