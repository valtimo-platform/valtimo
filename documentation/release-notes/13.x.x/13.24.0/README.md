# 13.24.0

{% hint style="info" %}
**Release date 15-04-2026**
{% endhint %}

## New Features

* **Redirect to case detail after form flow completion**

  When a case is created via a form flow, the user is now automatically redirected to the newly created case detail page
  after completing the last step. Previously, the user was returned to the case list without any indication of which case
  was created.

* **Publish notification plugin action for Notificaties API**

  A new plugin action "Publiceer een notificatie" has been added to the Notificaties API plugin. This action allows
  publishing notifications via the Notificaties API from a BPMN process, for example from a send task or intermediate
  throw event.

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

## Security

* **Dependencies**

  All frontend dependencies have been locked to specific versions.

## Bugfixes

* When a new version of a building block is created, forms and form flows are also copied over.
* When trying to create a new process definition, if that process definition key already exists in that context, an
  error message will be shown instead of overwriting the existing process definition.
