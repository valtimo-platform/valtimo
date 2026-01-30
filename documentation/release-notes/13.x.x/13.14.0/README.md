# 13.14.0

{% hint style="info" %}
**Release date 04-02-2026**
{% endhint %}

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* **ZGW: Documenten API document deletion**

  When deleting a case (zaak), linked documents are now only deleted from the Documenten API if they are not
  linked to any other cases. If a document is linked to multiple cases, only the relationship between the
  case and the document is removed.
