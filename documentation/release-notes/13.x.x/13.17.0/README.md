# 13.17.0

{% hint style="info" %}
**Release date 25-02-2026**
{% endhint %}

## New Features

* **Interactive table search filters**  
  Interactive table widgets now support filters that adapt to each field type. This ensures users can enter values in the correct format, making it easier and more intuitive to refine results.

* **Auto-deployment for zaakdetail sync configuration**

  Zaakdetail sync configuration can now be imported and exported via auto-deployment. This means the configuration
  can be managed through JSON files in the resource folder and is included in the case definition export.
  See [Zaakdetail sync](../../../features/case/zgw/zaakdetail-sync.md) for more information.

* **Auto-deployment for independent processes linked to a case**

  Independent processes linked to a case definition can now be imported and exported via auto-deployment. This allows managing
  which independent processes belong to a case definition through JSON configuration files. See
  [Processes](../../../features/case/processes.md) for more information.

## Enhancements
* **Plugin configuration title in process-link modal**
   Add the selected plugin configuration title in the process-link modal to clarify which plugin configuration is used in the process-link.

## Bugfixes

* **Fixed Task due date language update**

  Fixed an issue where the task due date picker in the task detail view did not update its language when the application
  language was changed.

* **Verzoeken plugin: Available processes not loading**
  Fixed an issue where, in some cases, the Verzoeken plugin failed to load the list of available processes when there was a process without a name.

* **Fix Formio Data Source URL**

  The Formio Data Source URL now no longer contains an additional `/api`.

- Fixed an issue where the Form.io custom component **Document Picker** did not show any files.
- Fixed an issue where the Form.io custom component **Valtimo File Upload** failed to upload files.
- Fixed file uploads so they now consistently use the correct **upload process** when uploading files.

* **Zaakdetail sync configuration not saved correctly when duplicating a case definition**

  Fixed an issue where duplicating a case definition would fail to correctly copy the zaakdetail sync configuration.
  The duplicated configuration reused the same database ID, causing a primary key conflict. Additionally, the
  repository queries now correctly match on both the case definition key and version tag.
