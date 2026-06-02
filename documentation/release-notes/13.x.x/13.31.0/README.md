# 13.31.0

{% hint style="info" %}
**Release date 03-06-2026**
{% endhint %}

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **Autocomplete suggestions for form-flow and access-control**

  The form flow and access control editors now offer autocomplete suggestions and inline documentation while editing.

## Bugfixes

* **Auto-assign now includes the first open task when a case assignee is set**

  When a case with `autoAssignTasks` enabled was assigned to a user, any task that already existed at that moment was not
  assigned to the new case owner. Only tasks created after the assignment were auto-assigned. The first open task now
  correctly receives the case assignee, matching the behaviour of subsequently created tasks.

* **Clearer error messages for plugin and building block failures**

  When a plugin could not be created or a building block decision could not be duplicated, the resulting error message
  was unreadable and showed internal placeholder text instead of the actual reason. These errors now show the intended,
  human-readable message, making it easier to understand what went wrong.
