# 13.9.0

{% hint style="info" %}
**Release date 24-12-2025**
{% endhint %}

## New Features

- **Enabling virus scanning**

When enabled, files uploaded to the Documenten API or in temporary file storage will be scanned for viruses.
More details can be found [here](../../../features/case/zgw/zgw-documents/README.md#enabling-virus-scanning)

## Enhancements

## Bugfixes

* Importing an existing case definition from an uploaded zip file will now overwrite the existing data.
* It is now possible to add new search fields to a case when no search fields exist yet. Previously this resulted in an
error because the system assumed the field already existed.
