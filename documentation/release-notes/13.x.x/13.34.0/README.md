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

* **Case definition could not be deleted when it contained a form flow**

  Deleting a case definition that had a form flow attached failed with an error. The only workaround was to delete the
  form flow definition first and then the case definition. Both can now be deleted in one step.

* **Form flows in draft case definitions could not be edited**

  Form flows in a draft case definition were incorrectly shown as read-only and can now be edited.

* **Uploading documents from a building block case**

  Fixed an issue where uploading a document from within a building block could fail to start the configured upload
  process.

* **Sortable controls hidden for non-sortable paths**

  In the case and task list column editors, the **Sortable** checkbox and **Default sort** dropdown are now hidden when
  the configured path does not support sorting.
