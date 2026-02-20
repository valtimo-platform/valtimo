# 13.15.0

{% hint style="info" %}
**Release date 11-02-2026**
{% endhint %}

## Enhancements

* **Widget color customization**

Fields, Collection and Table widgets now support color customization through a new appearance tab in the widget
configuration. Choose from a variety of colors including blue, purple, green, turquoise, orange, red, yellow, and
brown to visually distinguish widgets on the case detail page. For more information, see
[Widgets](../../../features/case/case-detail/tabs/widgets.md).

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
