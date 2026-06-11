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

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* New bugfix.
