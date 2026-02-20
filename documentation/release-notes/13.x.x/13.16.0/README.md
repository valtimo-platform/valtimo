# 13.16.0

{% hint style="info" %}
**Release date 18-02-2026**
{% endhint %}

## New Features

* **Added delete zaak resultaten action to zaken API plugin**

  The zaken API plugin now includes a new action called 'Delete zaak resultaten'. This action allows users to delete the results of a zaak.

* **Setting case retention date**

  The _retention period_ is a case status property that, when set, calculates the expiration date for the case.

  When that date is reached, the case and all associated processes (including process history) will be deleted. If
  present, the case is also removed from connected ZGW platforms (for example, case details, objects, and uploaded documents).

  See [Internal status](../../../features/case/case-detail/statuses.md) for the configuration of the retention date.

    +  **Note:** when the case status is set where the retention period is set to -1, no new retention date will be calculated, and any existing retention date will be cleared.


* **Building block form management**

  Building blocks now support their own form definitions. Forms can be created, edited, uploaded, and deleted
  directly from the **Forms** tab in the building block management view. These forms are scoped to a specific
  building block version and are automatically included when exporting or importing a building block.

  See [Building blocks - Forms](../../../features/building-blocks/forms.md) for more information.

* **User task support in building blocks**

  Building blocks now support user tasks with form process links. Tasks from building blocks automatically
  appear in the case task list and support auto-assignment when a case assignee is set.

  See [Building blocks](../../../features/building-blocks/README.md) for more information.

## Enhancements

* **Value resolver selector for building blocks**

  The value resolver selector in the form builder now correctly supports building block, case, and independent
  process contexts. This ensures that the right data sources are available when configuring form components
  in different process link types.

## Bugfixes

* Fixed an intermittent issue where the JSON editor would fail to display when editing document or form
  definitions.

* Fixed an issue that prevented users with specific Keycloak configurations from connecting to IKO.
