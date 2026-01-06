# 13.10.0

{% hint style="info" %}
**Release date 07-01-2026**
{% endhint %}

## New Features

## Enhancements
* Added support for updating the Zaak start date through the Update-zaak plugin action in the Zaken API plugin.

## Bugfixes

* Case list items should no longer require permissions other than `view_list` to view.
* Resolved issue where running processes were deleted when editing the BPMN.
* It is now possible to add new search fields to a case when no search fields exist yet. Previously this resulted in an error because the system assumed the field already existed.
