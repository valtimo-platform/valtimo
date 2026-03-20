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

* **Fixed auto-deployment of global forms and object management configurations**

  Forms used by object management (edit/view forms) could not be auto-deployed in Valtimo 13 because the form importer
  required a case definition context. Global forms can now be placed in `config/global/form/*.form.json` and object
  management configurations in `config/global/object-management/*.object-management.json` for automatic pickup on
  startup.
