# 13.18.0

{% hint style="info" %}
**Release date 04-03-2026**
{% endhint %}

## New Features

## Enhancements

* **Replaced case assign user component with Carbon Design System toggletip**

  The case assign user component has been refactored to use a Carbon toggletip with a combobox, replacing the custom searchable dropdown. Assignment now requires an explicit confirmation button click, consistent with the task assignment flow.

* **Removed searchable-dropdown and searchable-dropdown-select components**

  The custom `searchable-dropdown` and `searchable-dropdown-select` components have been removed in favour of Carbon's built-in combobox and dropdown components.

* **Improved toggletip theme support**

  Individual elements inside toggletip popovers (comboboxes, dropdowns, date pickers, and buttons) now correctly apply the toggletip theme. This ensures proper readability across light and dark mode.

* **Increased candidate user fetch limit**

  The candidate user fetch limit for case assignment has been increased to support larger user directories.

## Bugfixes

* JWT `scope`/`scp` claims are no longer automatically converted into user roles.
* Task assignee and due date now display correctly in the task modal regardless of task list column configuration
* Task data such as assignee and business key is no longer lost when the task modal receives a real-time (SSE) update
* Changing a due date inside the task modal now refreshes the parent task list
* Setting or removing a due date now shows a notification toast
* Stale task data no longer persists after closing the task modal
* Fixed an issue in the bulk assignment of cases where permission checks were not correctly applied per document.
