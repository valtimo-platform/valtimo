# 13.21.0

{% hint style="info" %}
**Release date 25-03-2026**
{% endhint %}

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* Fixed a bug where building blocks could not update the internal case status, case tags, or assignee of the calling
  case. The building block now correctly references the case definition of the parent case.

* **Fixed auto-deployment of global forms and object management configurations**

  Forms used by object management (edit/view forms) could not be auto-deployed in Valtimo 13 because the form importer
  required a case definition context. Global forms can now be placed in `config/global/form/*.form.json` and object
  management configurations in `config/global/object-management/*.object-management.json` for automatic pickup on
  startup.

* Fixed an issue in the migration script when upgrading from Valtimo 12. When the summary form is used for user tasks this
  will no longer cause an error when migrating.
