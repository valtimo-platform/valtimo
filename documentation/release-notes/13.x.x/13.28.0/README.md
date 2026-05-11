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
* **Person card widget**

  A new `person-card` widget type displays personal data for a single person (full name, birthdate, BSN, phone, email
  and city) in a compact card format on the case detail page. Field values are configured as JSON paths into the case
  document, and only the full name is required — empty fields are hidden in the rendered card. See the
  [Person card widget documentation](../../../features/case/case-detail/tabs/widgets.md) for the full list of fields
  and a configuration example.

* **Faster Case Progress tab**

  The Progress tab on the case details page now loads noticeably faster, especially for cases with many associated
  processes.

* **Open widget link in a new browser tab**

  Link-type action buttons on case widgets now support an "Open in new tab" option in widget management.
  When enabled, clicking the button opens the configured URL in a new browser tab instead of replacing
  the case detail page.

## Bugfixes

* SmartDocuments compatibility with newer SmartDocuments versions.
* When a header widget was configured, it was not possible to edit the header widget.

* **Recover from stuck migration locks**

  If an application instance was killed mid-migration, the migration lock could stay held and
  prevent other instances from starting. Valtimo now releases such stale locks automatically on
  startup and on graceful shutdown.
