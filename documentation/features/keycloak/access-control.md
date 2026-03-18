# Access control

{% hint style="success" %}
Available since Valtimo `13.20.0`.
{% endhint %}

Access to users in the `UserResource` can be configured through access control. More information about access control can be found [here](../../access-control).

### Resources and actions

<table><thead><tr><th width="329">Resource type</th><th width="143">Action</th><th>Effect</th></tr></thead><tbody><tr><td><code>com.ritense.valtimo.contract.authentication.User</code></td><td><code>view_list</code></td><td>Allows viewing the list of users or searching for users</td></tr><tr><td></td><td><code>view</code></td><td>Allows viewing details of a single user</td></tr></tbody></table>

### Examples

#### Permission to view and list users for ROLE_ADMIN

<pre class="language-json"><code class="lang-json">[
    {
        "resourceType": "com.ritense.valtimo.contract.authentication.User",
        "actions": [
            "view_list",
            "view"
        ],
        "roleKey": "ROLE_ADMIN"
    }
]
</code></pre>

#### Permission to view and list users for ROLE_USER with a condition

The following example allows users with `ROLE_USER` to view and list users, but only those users who also have the `ROLE_USER` role.

<pre class="language-json"><code class="lang-json">[
    {
        "resourceType": "com.ritense.valtimo.contract.authentication.User",
        "actions": [
            "view_list",
            "view"
        ],
        "roleKey": "ROLE_USER",
        "conditions": [
            {
                "type": "field",
                "field": "roles",
                "operator": "list_contains",
                "value": "ROLE_USER"
            }
        ]
    }
]
</code></pre>

This permission supports the following condition fields:
- `roles`: The list of roles assigned to the user.
