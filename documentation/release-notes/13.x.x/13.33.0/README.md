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

* **Value resolver support for Besluiten API plugin date fields**

  In the Besluiten API plugin, the *create besluit* action can now resolve the publication date, shipment date and
  response deadline from a value resolver expression (e.g. `pv:publicatiedatum` or `doc:/besluit/publicatiedatum`)
  instead of only a fixed date, selectable per field via an input-type toggle.

* **Building blocks support nested document properties**

  Input and output mappings on building block call activities can now reference nested paths in the case or building
  block document (e.g. `/person/name`), instead of only top-level properties.

## Bugfixes

* **Form flows in draft case definitions could not be edited**

  Form flows in a draft case definition were incorrectly shown as read-only and can now be edited.

* **Empty building block mapping dropdowns**

  Existing input and output mappings on a building block process link sometimes showed up with empty dropdowns. This
  has been fixed.

* **Keycloak-based database migrations failed against newer Keycloak servers**

  Database migrations that look up users in Keycloak could fail to start when running against a newer Keycloak
  version than the one Valtimo ships with. This has been resolved.

* **Misleading plugin configuration error when configuring a building block call activity**

  When a call activity to a building block was missing the required business key configuration, saving the
  process link failed with a confusing "No plugin configuration mapping provided" message. Valtimo now checks
  the call activity up front and shows a clear error that points to the missing business key configuration.

## Security

* **Spring Boot upgraded for CVE fixes**

  Upgraded Spring Boot to 3.5.15 to resolve several HIGH-severity CVEs.
