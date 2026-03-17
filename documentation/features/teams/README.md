# Teams

Teams are groups of users in Valtimo. They can be used to organize users and manage their access to resources.
A team has a unique key, a title, and a list of members.

## Use cases

* **Case assignment**: Cases (documents) can be assigned to teams. This allows all members of the team to see and manage
  the case.
* **Access control**: Teams can be used in access control rules to grant or deny access to resources based on team
  membership.

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
