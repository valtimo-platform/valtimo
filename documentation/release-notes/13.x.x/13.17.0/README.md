# 13.17.0

{% hint style="info" %}
**Release date 25-02-2026**
{% endhint %}

## New Features

* **Auto-deployment for zaakdetail sync configuration**

  Zaakdetail sync configuration can now be imported and exported via auto-deployment. This means the configuration
  can be managed through JSON files in the resource folder and is included in the case definition export.
  See [Zaakdetail sync](../../../features/case/zgw/zaakdetail-sync.md) for more information.

* **Auto-deployment for case definition process links**

  Case definition process links can now be imported and exported via auto-deployment. This allows managing which
  processes are linked to a case definition through JSON configuration files. See
  [Processes](../../../features/case/processes.md) for more information.

## Enhancements

## Bugfixes

* **Verzoeken plugin: Available processes not loading**
  Fixed an issue where, in some cases, the Verzoeken plugin failed to load the list of available processes when there was a process without a name.

* **Fix Formio Data Source URL**

  The Formio Data Source URL now no longer contains an additional `/api`. 

* **Zaakdetail sync configuration not saved correctly when duplicating a case definition**

  Fixed an issue where duplicating a case definition would fail to correctly copy the zaakdetail sync configuration.
  The duplicated configuration reused the same database ID, causing a primary key conflict. Additionally, the
  repository queries now correctly match on both the case definition key and version tag.
