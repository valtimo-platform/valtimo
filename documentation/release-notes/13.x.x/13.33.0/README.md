# 13.33.0

{% hint style="info" %}
**Release date 17-06-2026**
{% endhint %}

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **Configurable modal size for start forms**

  The process link configuration of a start event now offers the **Modal size** option (Extra small, Small, Medium,
  Large). When a case is created via the **Start case** button, the start form  modal opens in the configured size 
  instead of always being small. If multiple processes can create the case, the modal opens in the size configured 
  for the selected process. When no size is configured the modal keeps its previous
  default.

* **Start supporting process forms in the case detail panel**

  The process link configuration of a start event now offers a **Display type** option (Modal or Panel), defaulting to
  **Modal**. When a supporting process is started from the **Start** button with its start event configured as
  **Panel**, the start form opens in the case detail panel, the same way user task forms can. This requires the active
  tab to expose a panel. Otherwise the form opens in the modal as before. Form types that rely on view models or custom
  UI components always open in the modal.

## Bugfixes

* New bugfix.
