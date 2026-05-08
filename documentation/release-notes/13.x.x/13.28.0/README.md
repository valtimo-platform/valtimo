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

* **Zaak sync (per case definition)**

  A new "Zaak-synchronisatie" admin panel under `Admin > Cases > {Case name} > [ZGW]` configures how Valtimo
  propagates case changes to the linked zaak in the Zaken API, scoped per case definition. Two one-way
  synchronisations (Valtimo → Zaken API) are now available:
    - **Behandelaar sync** — when the dossier assignee changes, the linked zaak gets a behandelaar rol matching the
      assignee.
    - **Note sync** — Valtimo notes on the case are mirrored as `ZaakNotitie` on the linked zaak.

  See the [Zaak sync section](../../../features/case/zgw/zaken-api-sync.md) for details.

## Enhancements

* **`noteEventListenerEnabled` and `noteSubject` removed from the Zaken API plugin**

  These two properties moved off the Zaken API plugin and onto the new per-case-definition Zaak sync
  configuration (renamed to `noteSyncEnabled` and `noteSubject` respectively). The plugin now only owns
  connection settings; per-case-definition policy lives in the new "Zaak-synchronisatie" panel.

  See the [Zaak sync section](../../../features/case/zgw/zaken-api-sync.md) for details.

* **Open widget link in a new browser tab**

  Link-type action buttons on case widgets now support an "Open in new tab" option in widget management.
  When enabled, clicking the button opens the configured URL in a new browser tab instead of replacing
  the case detail page.

## Bugfixes

* When a header widget was configured, it was not possible to edit the header widget.
