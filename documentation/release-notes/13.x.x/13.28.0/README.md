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

* **Generic case list**

  A generic case list can be used instead of the default case list with case definitions listed in the sidebar. The
  generic case list shows cases across all case definitions similar to the task list. This feature needs to be enabled
  in the angular configuration file(s) in order to make use of it, via the `enableGenericCaseList` property.
* **Open widget link in a new browser tab**

  Link-type action buttons on case widgets now support an "Open in new tab" option in widget management.
  When enabled, clicking the button opens the configured URL in a new browser tab instead of replacing
  the case detail page.

## Bugfixes

* When a header widget was configured, it was not possible to edit the header widget.
