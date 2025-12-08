# ✅ Tasks

## Access control

Access to the processes can be configured through access control. More information about access control can be found [here](https://docs.valtimo.nl/features/access-control).

### Resources and actions

<table><thead><tr><th width="329">Resource type</th><th width="143">Action</th><th>Effect</th></tr></thead><tbody><tr><td><code>com.ritense.valtimo.camunda.domain.CamundaTask</code></td><td><code>assign</code></td><td>Allows assigning users to a task.</td></tr><tr><td></td><td><code>assignable</code></td><td>Allows users to be assigned to a task.</td></tr><tr><td></td><td><code>claim</code></td><td>Allows claiming of a task.</td></tr><tr><td></td><td><code>complete</code></td><td>Allows completion of a task.</td></tr><tr><td></td><td><code>view</code></td><td>Allows viewing of a task.</td></tr><tr><td></td><td><code>view_list</code></td><td>Allows viewing of tasks.</td></tr><tr><td><code>com.ritense.valtimo.camunda.domain.CamundaIdentityLink</code></td><td></td><td></td></tr></tbody></table>

Task identity links have no actions currently. As a result, they can only be used as part of container conditions. See the example here on how to use this.

### Examples

<details>

<summary>Permission to complete a task of one candidate group</summary>

{% code overflow="wrap" %}
```json
{
    "resourceType": "com.ritense.valtimo.camunda.domain.CamundaTask",
    "action": "view",
    "conditions": [
        {
            "type": "container",
            "resourceType": "com.ritense.valtimo.camunda.domain.CamundaIdentityLink",
            "conditions": [
                {
                    "type": "field",
                    "field": "groupId",
                    "operator": "==",
                    "value": "ROLE_USER"
                }
            ]
        }
    ]
}
```
{% endcode %}

</details>

<details>

<summary>Permission to claim a task if unassigned</summary>

{% code overflow="wrap" %}
```json
{
    "resourceType": "com.ritense.valtimo.camunda.domain.CamundaTask",
    "action": "claim",
    "conditions": [
        {
            "type": "field",
            "field": "assigneeId",
            "operator": "==",
            "value": null
        }
    ]
}
```
{% endcode %}

</details>
