# 13.14.0

{% hint style="info" %}
**Release date 04-02-2026**
{% endhint %}

## New Features

* **Orange status tag**

  Added a new orange status tag to the UI for enhanced visibility of specific case statuses.

## Enhancements

* **Enhanced testability with data-test-id attributes**

  Added `data-test-id` attributes to various UI components to facilitate automated testing.

## Bugfixes

* **ZGW: Documenten API document deletion**

  When deleting a case (zaak), linked documents are now only deleted from the Documenten API if they are not
  linked to any other cases. If a document is linked to multiple cases, only the relationship between the
  case and the document is removed.
