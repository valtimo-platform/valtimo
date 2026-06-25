# 13.35.0

{% hint style="info" %}
**Release date 01-07-2026**
{% endhint %}

## New Features

* **Task properties in value paths**

  Task properties (`task:createTime`, `task:name`, `task:assignee`, `task:dueDate`, `task:assignedTeamTitle`) can now be
  selected anywhere a value path is configured.

## Enhancements

* **Task list columns: path picker**

  The path field in the task list column modal is now a searchable dropdown instead of a free-text input.

## Bugfixes

* **Sortable controls hidden for non-sortable paths**

  In the case and task list column editors, the **Sortable** checkbox and **Default sort** dropdown are now hidden when
  the configured path does not support sorting.
