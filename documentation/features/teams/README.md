# Teams

Teams are groups of users in Valtimo. They can be used to organize users and manage their access to resources.
A team has a unique key, a title, and a list of members.

## Use cases

* **Case assignment**: Cases (documents) can be assigned to teams. This allows all members of the team to see and manage
  the case.
* **Automatic task team assignment**: When a user task is created, the case's assigned team is automatically assigned to
  the task — but only if one of the task's BPMN candidate groups matches the team key. This requires the case definition
  to have `canHaveAssignee` and `autoAssignTasks` enabled. Tasks without candidate groups are never auto-assigned. When
  the team assignee on a case document changes, all open tasks whose candidate groups match the new team key are updated.
  When the case is unassigned, the team is removed from all open tasks.
* **Access control**: Teams can be used in access control rules to grant or deny access to resources based on team
  membership. For example, tasks can be restricted so that users only see tasks whose candidate group matches one of
  their teams. See [Tasks access control](../case/tasks/README.md) for an example.

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
