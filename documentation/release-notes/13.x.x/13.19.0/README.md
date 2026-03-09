# 13.19.0

{% hint style="info" %}
**Release date 11-03-2026**
{% endhint %}

## New Features

* **Unread tasks highlighted in the task list**

A read-status marker has been added to tasks. Tasks that have not yet been opened are now indicated with a bullet displayed next to the task title.
This improvement helps case handlers working on multiple cases to quickly distinguish newly created or unopened tasks from tasks that have already been reviewed.

* **Added PBAC conditions for Resources based on Case definition**

PBAC conditions for Resources (Case related documents on the Document API) allow role-based filtering by case definition

## Enhancements

* **Redesigned task assignment interaction**

  The task assign user popover now offers a two-step flow. When no user is assigned, clicking "Assign" presents a choice between "Assign to me" for instant self-assignment, or "Assign to other user" which opens a searchable user dropdown. The current user is sorted to the top of the candidate user list for quicker selection. When a task is already assigned, hovering the assignee name reveals a "Click to edit" button that opens an edit popover with the current assignee pre-selected, an assign button, and an unassign button. This applies to both the case detail task list and the standalone tasks page.

* **Redesigned task due date interaction**

  When a task already has a due date, hovering the due date text now reveals a "Click to edit" button that opens an edit popover pre-filled with the current date, along with a submit button and a remove button. This matches the new assignment interaction pattern and applies to both the case detail task list and the standalone tasks page.

## Bugfixes

* New bugfix.
