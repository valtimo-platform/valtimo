# 13.33.0

{% hint style="info" %}
**Release date 17-06-2026**
{% endhint %}

## New Features

* **Load a zaak in a form flow**

  A new `zakenFormFlow` bean lets form flows load a zaak from the Zaken API by its `identificatie` through a `getZaak`
  method that can be used in SpEL expressions (for example `onOpen` or `onComplete`). The full zaak is returned, so any
  of its fields can be used in subsequent steps or conditions. Access is secured with PBAC: a new `Zaak` resource type
  with a `view` action ensures only users authorized for the matching zaaktype can load a zaak. See
  [Load a zaak in a form flow](../../../features/zgw/load-zaak-in-form-flow.md) for details.


## Enhancements

* **Building blocks support nested document properties**

  Input and output mappings on building block call activities can now reference nested paths in the case or building
  block document (e.g. `/person/name`), instead of only top-level properties.

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* **Empty building block mapping dropdowns**

  Existing input and output mappings on a building block process link sometimes showed up with empty dropdowns. This
  has been fixed.

* **Keycloak-based database migrations failed against newer Keycloak servers**

  Database migrations that look up users in Keycloak could fail to start when running against a newer Keycloak
  version than the one Valtimo ships with. This has been resolved.
