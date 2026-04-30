# Configurable elements

This page provides an overview of the configurable elements within Access Control in Valtimo.

In Access Control, policies can be defined for specific elements to manage user access and permissions precisely. These
policies can be tailored with conditions, allowing for detailed and customized access configurations.

Each configurable element offers a set of actions that can be adjusted to fit your access needs. While not all actions
are available for every element, each element provides a relevant subset of actions that logically apply to its
function, ensuring that your access settings are both efficient and meaningful.

## Elements configurable with Access control

Below the full list of elements within Valtimo that can and need to be configured in Access Control. Per element a list
of configurable actions is documented and an example of the configuration is added. The available actions per element
define what can be configured for that element.

<table>
	<thead>
		<tr>
			<th width="143.14453125" valign="top">Feature</th>
			<th width="168.671875" valign="top">Resource name</th>
			<th width="306.703125" valign="top">Resource type</th>
			<th valign="top">Module</th>
		</tr>
	</thead>
	<tbody>
		<tr>
			<td valign="top">
				<a href="../case/#access-control">
					<strong>Cases</strong>
				</a>
			</td>
			<td valign="top"></td>
			<td valign="top">
				<code>com.ritense.case_.domain.definition.CaseDefinition</code>
			</td>
			<td valign="top"></td>
		</tr>
		<tr>
			<td valign="top"></td>
			<td valign="top">
				<a href="../case/document-definition.md#access-control">Document</a>
			</td>
			<td valign="top">
				<code>com.ritense.document.domain.impl.JsonSchemaDocument</code>
			</td>
			<td valign="top">Document</td>
		</tr>
		<tr>
			<td valign="top"></td>
			<td valign="top">
				<a href="../case/document-definition.md#access-control">Document definition</a>
			</td>
			<td valign="top">
				<code>com.ritense.document.domain.impl.JsonSchemaDocumentDefinition</code>
			</td>
			<td valign="top">Document</td>
		</tr>
		<tr>
			<td valign="top"></td>
			<td valign="top">
				<a href="../case/document-definition.md#access-control">Document snapshot</a>
			</td>
			<td valign="top">
				<code>com.ritense.document.domain.impl.snapshot.JsonSchemaDocumentSnapshot</code>
			</td>
			<td valign="top">Document</td>
		</tr>
		<tr>
			<td valign="top"></td>
			<td valign="top">
				<a href="../case/case-detail/tabs/#access-control">Notes</a>
			</td>
			<td valign="top">
				<code>com.ritense.note.domain.Note</code>
			</td>
			<td valign="top">Notes</td>
		</tr>
		<tr>
			<td valign="top"></td>
			<td valign="top">
				<a href="../case/case-list/search-fields.md#access-control">Search fields</a>
			</td>
			<td valign="top">
				<code>com.ritense.document.domain.impl.searchfield.SearchField</code>
			</td>
			<td valign="top">Document</td>
		</tr>
		<tr>
			<td valign="top"></td>
			<td valign="top">
				<a href="../case/case-detail/tabs/#access-control">Tabs</a>
			</td>
			<td valign="top">
				<code>com.ritense.case.domain.CaseTab</code>
			</td>
			<td valign="top">CaseTab</td>
		</tr>
		<tr>
			<td valign="top"></td>
			<td valign="top">
				<a href="../case/case-detail/tabs/widgets.md#access-control">Widgets</a>
			</td>
			<td valign="top">
				<code>com.ritense.case_.domain.tab.CaseWidget</code>
			</td>
			<td valign="top"></td>
		</tr>
		<tr>
			<td valign="top">
				<a href="../dashboard/#access-control">
					<strong>Dashboard</strong>
				</a>
			</td>
			<td valign="top"></td>
			<td valign="top">
				<code>com.ritense.dashboard.domain.Dashboard</code>
			</td>
			<td valign="top"></td>
		</tr>
		<tr>
			<td valign="top">
				<strong>Process</strong>
			</td>
			<td valign="top">
				<a href="../process/#access-control">Execution</a>
			</td>
			<td valign="top">
				<code>com.ritense.valtimo.operaton.domain.OperatonExecution</code>
			</td>
			<td valign="top">Core</td>
		</tr>
		<tr>
			<td valign="top"></td>
			<td valign="top">
				<a href="../process/#access-control">Definition</a>
			</td>
			<td valign="top">
				<code>com.ritense.valtimo.operaton.domain.OperatonProcessDefinition</code>
			</td>
			<td valign="top">Core</td>
		</tr>
		<tr>
			<td valign="top">
				<strong>Tasks</strong>
			</td>
			<td valign="top">
				<a href="../case/tasks/#access-control">Tasks</a>
			</td>
			<td valign="top">
				<code>com.ritense.valtimo.operaton.domain.OperatonTask</code>
			</td>
			<td valign="top">Core</td>
		</tr>
		<tr>
			<td valign="top">
				<strong>Teams</strong>
			</td>
			<td valign="top">
				<a href="../teams/README.md#access-control">Teams</a>
			</td>
			<td valign="top">
				<code>com.ritense.team.domain.Team</code>
			</td>
			<td valign="top">Team</td>
		</tr>
		<tr>
			<td valign="top"></td>
			<td valign="top">
				<a href="../case/tasks/#access-control">Identity links</a>
			</td>
			<td valign="top">
				<code>com.ritense.valtimo.operaton.domain.OperatonIdentityLink</code>
			</td>
			<td valign="top">Core</td>
		</tr>
		<tr>
			<td valign="top">
				<strong>Users</strong>
			</td>
			<td valign="top">
				<a href="../keycloak/access-control.md">User</a>
			</td>
			<td valign="top">
				<code>com.ritense.valtimo.contract.authentication.User</code>
			</td>
			<td valign="top">Core</td>
		</tr>
		<tr>
			<td valign="top">
				<strong>ZGW</strong>
			</td>
			<td valign="top">
				<a href="../case/zgw/zgw-documents/access-control.md">Documents</a>
			</td>
			<td valign="top">
				<code>com.ritense.documentenapi.authorization.ZgwDocument</code>
			</td>
			<td valign="top">Documenten API</td>
		</tr>
	</tbody>
</table>

## Actions configurable with Access control

<table><thead><tr><th width="131" valign="top">Action</th><th width="423" valign="top">Function</th><th valign="top">Examples</th></tr></thead><tbody><tr><td valign="top"><strong>Assign</strong></td><td valign="top">Gives permission to assign that element to someone</td><td valign="top">Case or Task</td></tr><tr><td valign="top"><strong>Assignable</strong></td><td valign="top">Makes users selectable when the element is assigned</td><td valign="top">Case or Task</td></tr><tr><td valign="top"><strong>Create</strong></td><td valign="top">Enables users to create that element</td><td valign="top">Case or Case note</td></tr><tr><td valign="top"><strong>Claim</strong></td><td valign="top">Enables users to claim the element</td><td valign="top">Case or Task</td></tr><tr><td valign="top"><strong>Delete</strong></td><td valign="top">Enables users to delete the element</td><td valign="top">Case or Case note</td></tr><tr><td valign="top"><strong>Modify</strong></td><td valign="top">Enables users to modify the elements details</td><td valign="top">Case or Case note</td></tr><tr><td valign="top"><strong>View</strong></td><td valign="top">Gives permission to view the elements details</td><td valign="top">Case or Task</td></tr><tr><td valign="top"><strong>View-list</strong></td><td valign="top">Gives permission to view the element in a list</td><td valign="top">Case, Task, Case note</td></tr></tbody></table>

### Nesting actions

{% hint style="success" %}
Available since Valtimo `12.17.0`
{% endhint %}

The different actions for a configuration can be nested. This makes it easier to set up the configuration and keep
conditions the same between different permissions.

_**Before Valtimo `12.17.0`**_:

```
        {
            "resourceType": "com.ritense.document.domain.impl.JsonSchemaDocument",
            "action": "view_list",
            "roleKey": "ROLE_USER",
            "conditions": [
                {
                    "type": "field",
                    "field": "assigneeId",
                    "operator": "==",
                    "value": "${currentUsername}"
                }
            ]
        },
        {
            "resourceType": "com.ritense.document.domain.impl.JsonSchemaDocument",
            "action": "view",
            "roleKey": "ROLE_USER",
            "conditions": [
                {
                    "type": "field",
                    "field": "assigneeId",
                    "operator": "==",
                    "value": "${currentUsername}"
                }
            ]
        },
```

_**Since Valtimo `12.17.0`**_:

```
        {
            "resourceType": "com.ritense.document.domain.impl.JsonSchemaDocument",
            "actions": [
                "view_list",
                "view",
            ],
            "roleKey": "ROLE_USER",
            "conditions": [
                {
                    "type": "field",
                    "field": "assigneeId",
                    "operator": "==",
                    "value": "${currentUsername}"
                }
            ]
        },
```
