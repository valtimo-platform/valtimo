# 13.31.0

{% hint style="info" %}
**Release date 03-06-2026**
{% endhint %}

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* **Auto-assign now includes the first open task when a case assignee is set**

  When a case with `autoAssignTasks` enabled was assigned to a user, any task that already existed at that moment was not
  assigned to the new case owner. Only tasks created after the assignment were auto-assigned. The first open task now
  correctly receives the case assignee, matching the behaviour of subsequently created tasks.
