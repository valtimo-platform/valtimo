# 13.34.0

{% hint style="info" %}
**Release date 24-06-2026**
{% endhint %}

## New Features

* **Task properties in value paths**

  Task properties (`task:createTime`, `task:name`, `task:assignee`, `task:dueDate`, `task:assignedTeamTitle`) can now be
  selected anywhere a value path is configured.

## Enhancements

* **Task list columns: path picker**

  The path field in the task list column modal is now a searchable dropdown instead of a free-text input.

## Bugfixes

* **Form flows in draft case definitions could not be edited**

  Form flows in a draft case definition were incorrectly shown as read-only and can now be edited.

* **Sortable controls hidden for non-sortable paths**

  In the case and task list column editors, the **Sortable** checkbox and **Default sort** dropdown are now hidden when
  the configured path does not support sorting.
