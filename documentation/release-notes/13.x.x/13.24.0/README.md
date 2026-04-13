# 13.24.0

{% hint style="info" %}
**Release date 15-04-2026**
{% endhint %}

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **Automatic team assignment via candidate groups**

  When a user task is created with a candidate group that matches the case's assigned team key, the team is now
  automatically assigned to the task. This requires the case definition to have `canHaveAssignee` and `autoAssignTasks`
  enabled. See [Teams](../../features/teams/README.md) for more information.

* **Automatic user assignment changes**

  For case definitions with `canHaveAssignee` and `autoAssignTasks` enabled, the propagation of user and team
  assignments from a case to its open tasks is now conservative: a task's assignee is only re-synced when its current
  assignee or team still matches the case's assignee previous value. Tasks that were (re)assigned to a different user or
  team — either manually or by another process — are left untouched. The same rule applies when the case's
  assignee or team is cleared: only tasks that still hold that exact user or team are cleared.

## Bugfixes

* New bugfix.
