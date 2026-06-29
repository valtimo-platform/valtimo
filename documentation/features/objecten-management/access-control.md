# Access control

{% hint style="warning" %}
Object Management access control is behind a feature flag and disabled by default.
Enable with: `valtimo.object-management.authorization.enabled=true`
Or via environment variable: `VALTIMO_OBJECT_MANAGEMENT_AUTHORIZATION_ENABLED=true`
{% endhint %}

{% hint style="danger" %}
**Plugin compatibility warning**

Enabling Object Management PBAC can break second-party and third-party plugins that call `ObjectManagementService` methods.

Plugins that access Object Management configurations during startup (e.g., in `getKanaalFilters()`) or during process execution must wrap these calls in `runWithoutAuthorization { }` to bypass PBAC checks in system contexts.

**Before enabling PBAC:**
1. Verify all installed plugins are compatible with Object Management PBAC
2. Contact plugin vendors to confirm compatibility
3. Test in a non-production environment first

**For plugin developers:** When calling `ObjectManagementService.getById()` or similar methods from startup contexts or internal operations, wrap the call:

```kotlin
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization

val objectManagement = runWithoutAuthorization {
    objectManagementService.getById(configId)
}
```
{% endhint %}

## Resources and actions

Object Management access control involves two resource types:

### ObjectManagement (configuration level)

Controls access to Object Management configurations.

| Resource type | Action | Effect |
|---------------|--------|--------|
| `com.ritense.objectmanagement.domain.ObjectManagement` | `view` | View configuration details, use in forms |
| `com.ritense.objectmanagement.domain.ObjectManagement` | `view_list` | See configuration in menu |

### Object (data level)

Controls access to the actual objects stored in the Objecten API. These permissions are checked when fetching object data.

| Resource type | Action | Effect |
|---------------|--------|--------|
| `com.ritense.objectenapi.security.Object` | `view` | View individual object details |
| `com.ritense.objectenapi.security.Object` | `view_list` | List objects from Objecten API |
| `com.ritense.objectenapi.security.Object` | `create` | Create new objects |
| `com.ritense.objectenapi.security.Object` | `modify` | Modify existing objects |
| `com.ritense.objectenapi.security.Object` | `delete` | Delete objects |

{% hint style="warning" %}
**Both resource types required**

To use the Object Management UI, users need permissions on BOTH resource types:
- `ObjectManagement` permissions control which configurations are visible
- `Object` permissions control what operations can be performed on the data

Without `Object` `view_list` permission, users will see a 403 error when trying to list objects even if they have `ObjectManagement` permissions.
{% endhint %}

## Permission to feature mapping

| Feature | Required ObjectManagement | Required Object |
|---------|---------------------------|-----------------|
| See configuration in menu | `view_list` | - |
| View object list page | `view_list` | `view_list` |
| View object detail page | `view` | `view` |
| Object Management Select form.io component | `view` + `view_list` | `view` + `view_list` |
| Create new object | - | `create` |
| Edit object | - | `modify` |
| Delete object | - | `delete` |

{% hint style="info" %}
Admin pages (configuration management) are additionally gated by `ROLE_ADMIN` at the HTTP security level.
{% endhint %}

## Permission examples

<details>
<summary>Grant all users view access to all Object Management configurations</summary>

```json
[
  {
    "resourceType": "com.ritense.objectmanagement.domain.ObjectManagement",
    "action": "view",
    "roleKey": "ROLE_USER"
  },
  {
    "resourceType": "com.ritense.objectmanagement.domain.ObjectManagement",
    "action": "view_list",
    "roleKey": "ROLE_USER"
  }
]
```

</details>

<details>
<summary>Restrict view access to specific configuration by title condition</summary>

```json
[
  {
    "resourceType": "com.ritense.objectmanagement.domain.ObjectManagement",
    "action": "view",
    "roleKey": "ROLE_USER",
    "conditions": [
      {
        "type": "field",
        "field": "title",
        "operator": "==",
        "value": "PublicObjects"
      }
    ]
  }
]
```

</details>

## Migration

1. Deploy the new version
2. Configure permission JSON files for your roles
3. Enable the flag: `valtimo.object-management.authorization.enabled=true` (or env var `VALTIMO_OBJECT_MANAGEMENT_AUTHORIZATION_ENABLED=true`)
4. Verify access in the UI

{% hint style="info" %}
When the flag is disabled (default), all authenticated users have full access to Object Management configurations.
When enabled, access is controlled by the configured permissions.
{% endhint %}
