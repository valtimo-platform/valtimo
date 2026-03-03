# 13.18.0

{% hint style="info" %}
**Release date 04-03-2026**
{% endhint %}

## New Features

* **Unread tasks highlighted in task list**

  A read-status marker has been added to tasks. Tasks that have not yet been opened are now indicated with a bullet displayed next to the task title.
  This improvement helps case handlers working on multiple cases to quickly distinguish newly created or unopened tasks from tasks that have already been reviewed.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* JWT `scope`/`scp` claims are no longer automatically converted into user roles.
* Task assignee and due date now display correctly in the task modal regardless of task list column configuration
* Task data such as assignee and business key is no longer lost when the task modal receives a real-time (SSE) update
* Changing a due date inside the task modal now refreshes the parent task list
* Setting or removing a due date now shows a notification toast
* Stale task data no longer persists after closing the task modal
