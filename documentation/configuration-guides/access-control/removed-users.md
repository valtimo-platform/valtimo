# Users removed from Keycloak

{% hint style="success" %}
The log warning for a refused access check, and a process step skipping a case assignment instead of stopping, are available since Valtimo `13.50.0`. The other behavior on this page applies since Valtimo `13.42.0`.
{% endhint %}

Users are managed in Keycloak, while tasks, cases, form drafts and teams in Valtimo refer to those users by name. When an employee leaves and is deleted from Keycloak, these references remain. This page describes what Valtimo does with each reference, and how an administrator hands over the work of a removed user.

Valtimo does not unassign or clean up the work of a removed user automatically. The references stay in place until an administrator reassigns or unassigns the work.

---

## When a user counts as removed

Valtimo asks Keycloak for a user when it needs one. A user counts as removed when Keycloak reports that the user does not exist, or that the user is disabled. Valtimo handles both situations the same way.

{% hint style="warning" %}
When Keycloak cannot be reached, Valtimo does **not** treat users as removed. The request that needed the user fails with an error instead. A Keycloak outage therefore never skips a notification, never skips an assignment and never silently refuses access as if the user were deleted.
{% endhint %}

---

## Behavior per situation

| Situation | What Valtimo does |
|-----------|-------------------|
| A task is assigned to a removed user | The task can still be opened, reassigned to another user and unassigned. The task keeps the removed user as its assignee. The task details show the username instead of the full name; the assignee column of the task list stays empty. |
| A task is assigned to a removed user by a process | The process continues. No assignment notification is sent to the removed user, and the application log records that the user could not be found. |
| A case is assigned to a removed user | The case can still be opened, reassigned to another user and unassigned. The case keeps showing the name it had when it was assigned. |
| A case setting assigns new tasks to the case assignee (**Automatically assign user tasks to case handler**), and the case assignee is removed | The process continues and the new tasks stay unassigned. The application log records that the user could not be found. |
| A process step assigns the case to a removed user | The process continues. The case keeps its current assignee, and the application log records that the user could not be found. |
| A user assigns a task to a removed user | The assignment is refused and the task keeps its current assignee. The assign dialogs only offer users that exist in Keycloak, so this happens only when a user is removed while the dialog is open. |
| A user assigns a case to a removed user | The assignment is refused and the case keeps its current assignee, in the same way as for a task. |
| A form draft was saved by a removed user | The draft is still shown. The username is shown instead of the full name. |
| A team has a removed user as a member | The team is still shown. The username is shown instead of the full name, and the member can be removed from the team. |
| Access is checked on behalf of a removed user | Access is refused. The application log records a warning naming the user, the action and the resource, and says that the user was not found in the identity provider or is disabled. |

{% hint style="info" %}
The warning for a refused access check distinguishes a removed user from a user who exists but lacks the permission. A user who lacks the permission is refused without a warning.
{% endhint %}

---

## Handing over the work of a removed user

Remove a user from Keycloak only after the work is handed over, or hand it over afterwards in the same way.

{% stepper %}
{% step %}
Find the open tasks and cases assigned to the user
{% endstep %}
{% step %}
Open each task or case and assign it to a colleague, or unassign it so that anyone can pick it up
{% endstep %}
{% step %}
Remove the user from the teams they were a member of
{% endstep %}
{% step %}
Check process definitions and case settings that assign work to the user by name or email address, and change them to an existing user
{% endstep %}
{% endstepper %}

{% hint style="warning" %}
A process step that assigns a case to a user who does not exist no longer stops the process. A mistyped email address in such a step is therefore only visible as a warning in the application log.
{% endhint %}
