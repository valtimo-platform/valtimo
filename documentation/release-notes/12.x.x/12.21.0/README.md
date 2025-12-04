# 12.21.0

{% hint style="info" %}
**Release date 03-12-2025**
{% endhint %}

## New features

* A new field has been added to the set-zaakstatus action in the Zaken API plugin that allows setting the date of a zaak-status.
* The Zaken API plugin now supports a plugin action to retrieve a list of Zaakbesluiten.
* The Besluiten API plugin now supports two new plugin actions:
  * to modify a Besluit, specifically to change the 'vervaldatum' and 'vervalreden'.
  * to retrieve an individual Besluit

## **Bugfixes**

* The asynchronous handling of Notificatie API events would, in some scenario's, retry the same event indefinitely.
