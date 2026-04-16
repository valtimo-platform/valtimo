# 13.24.0

{% hint style="info" %}
**Release date 15-04-2026**
{% endhint %}

## New Features

* **Redirect to case detail after form flow completion**

  When a case is created via a form flow, the user is now automatically redirected to the newly created case detail page
  after completing the last step. Previously, the user was returned to the case list without any indication of which case
  was created.

* **Ad-hoc building blocks on a case**

  Case definitions now have an **Actions** tab in case configuration where administrators manage the items that are
  startable from the **Start** button on the case detail page. The tab lists both processes linked to the case definition
  and ad-hoc building blocks, and allows their visibility and ordering to be managed from a single place.

  For more information, see [Actions](../../../features/case/actions.md).

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
* Fixed 403 error in Operaton Cockpit
