# Teams

Teams are groups of users in Valtimo. They can be used to organize users and manage their access to resources.
A team has a unique key, a title, and a list of members.

## Use cases

* **Case assignment**: Cases (documents) can be assigned to teams. This allows all members of the team to see and manage
  the case.
* **Automatic task assignment**: When a case has an assignee or a team, tasks that belong to the case can be
  automatically assigned to match. See [Automatic task assignment](#automatic-task-assignment) below.
* **Access control**: Teams can be used in access control rules to grant or deny access to resources based on team
  membership. For example, tasks can be restricted so that users only see tasks whose candidate group matches one of
  their teams. See [Tasks access control](../case/tasks/README.md) for an example.

## Automatic task assignment

User tasks that belong to a case can inherit the case's user assignee and team assignee. This keeps tasks in sync
with the case without manual intervention.

Auto assignment is opt-in per case definition. Both of the following flags must be enabled on the case definition:

* `canHaveAssignee` — the case supports an assignee or team.
* `autoAssignTasks` — changes to the case's assignee/team are propagated to its tasks.

When enabled, auto assignment kicks in for user tasks.

### On task creation

When a user task is created, Valtimo assigns a team based on the task's BPMN candidate groups:

1. If the case has a team assigned and one of the task's candidate groups matches that team key, the case's team is
   assigned to the task.
2. Otherwise, the task is assigned to the first candidate group that contains a team.

Tasks without any BPMN candidate groups are never auto-assigned.

### On case assignee or team change

When the assignee or team on the case changes, Valtimo re-syncs open tasks that belong to the case — but
only those whose current value still matches the case's previous value. Tasks that have since been (re)assigned to a
different user or team are left untouched.

### On case unassign

When the case's assignee or team is cleared, Valtimo clears the corresponding value on open tasks — but only on tasks
that still hold the same assignee or team the case had. Tasks that were re-assigned individually in the meantime are
left untouched.

## Access control

The following resources and actions are available for managing teams and their members.

### Resources and actions

<table>
	<thead>
		<tr>
			<th width="357">Resource type</th>
			<th width="111">Action</th>
			<th>Effect</th>
		</tr>
	</thead>
	<tbody>
		<tr>
			<td>com.ritense.team.domain.Team</td>
			<td>assign</td>
			<td>Add users to a team or remove them from it.</td>
		</tr>
		<tr>
			<td>com.ritense.team.domain.Team</td>
			<td>create</td>
			<td>Create a new team.</td>
		</tr>
		<tr>
			<td>com.ritense.team.domain.Team</td>
			<td>delete</td>
			<td>Delete a team.</td>
		</tr>
		<tr>
			<td>com.ritense.team.domain.Team</td>
			<td>modify</td>
			<td>Modify an existing team.</td>
		</tr>
		<tr>
			<td>com.ritense.team.domain.Team</td>
			<td>view</td>
			<td>Allows viewing of a team.</td>
		</tr>
		<tr>
			<td>com.ritense.team.domain.Team</td>
			<td>view_list</td>
			<td>Allows viewing of teams.</td>
		</tr>
		<tr>
			<td>com.ritense.valtimo.contract.authentication.User</td>
			<td>view_list</td>
			<td>View the list of users when adding members to a team.</td>
		</tr>
	</tbody>
</table>
