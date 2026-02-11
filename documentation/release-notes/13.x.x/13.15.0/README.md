# 13.15.0

{% hint style="info" %}
**Release date 11-02-2026**
{% endhint %}

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **Widget appearance tab**

The Style tab has been replaced by the Appearance tab. For Fields, Collection, and Table widgets, this tab now includes the available color options, including High contrast, allowing each widget to define its own visual style.
## Bugfixes

* When working with the JSON editor for document or form definitions, the editor would occasionally fail to display.
  This issue has been resolved, and the JSON editor should now appear consistently.

* **Swagger UI page not loading**

  Fixed an issue where the Swagger UI page would not load. Additionally, users with `ROLE_ADMIN` can now access the
  Swagger page.

* **Custom widget data loading**

  Fixed an issue where custom widgets would incorrectly trigger data fetching operations. Custom widgets no longer
  attempt to load data, as they are responsible for managing their own data requirements.

* **DMN decision table version tags not updating**

  Fixed an issue where DMN decision table version tags were not being updated when linking a process to a case
  definition. Decision tables referenced in business rule tasks now correctly receive the case definition version tag.
