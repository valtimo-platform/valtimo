# Access control

{% hint style="warning" %}
Object Management access control is behind a feature flag and disabled by default.
Enable with: `valtimo.object-management.authorization.enabled=true`
Or via environment variable: `VALTIMO_OBJECT_MANAGEMENT_AUTHORIZATION_ENABLED=true`
{% endhint %}

{% hint style="danger" %}
**Plugin compatibility warning**

The only Object Management PBAC surface is the config-list method `ObjectManagementService.getConfigurationsForUser()`,
which enforces the `view_list` permission. The `getById()` and `getAll()` methods no longer enforce Object Management
PBAC, so they do not require a `runWithoutAuthorization { }` wrapper.

Access to the object data itself is governed by the always-on objecten-api `Object` PBAC (no feature flag). This can
break second-party and third-party plugins that read objects during startup (e.g., in `getKanaalFilters()`) or during
process execution. Such system and startup callers of Objecten API operations must wrap the call in
`runWithoutAuthorization { }` to bypass PBAC checks in system contexts.

**Before enabling PBAC:**
1. Verify all installed plugins are compatible with Object Management PBAC
2. Contact plugin vendors to confirm compatibility
3. Test in a non-production environment first

**For plugin developers:** When reading objects from the Objecten API in startup contexts or internal operations,
wrap the call:

```kotlin
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization

val objects = runWithoutAuthorization {
    // Objecten API operation invoked from a system context
}
```
{% endhint %}

## Resources and actions

Object Management access control involves two resource types:

### ObjectManagement (configuration level)

Controls access to Object Management configurations.

| Resource type | Action | Effect |
|---------------|--------|--------|
| `com.ritense.objectmanagement.domain.ObjectManagement` | `view_list` | See configuration in the data menu and object-list page; used for the form component's configuration lookup |

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
**Object data access is governed solely by `Object` PBAC**

Access to object data is controlled entirely by the always-on objecten-api `Object` permissions, independent of the
`ObjectManagement` permissions and independent of the `valtimo.object-management.authorization.enabled` flag:
- `ObjectManagement` `view_list` controls which configurations are visible in the data menu and object-list page.
- `Object` permissions control what operations can be performed on the data.

Without the `Object` `view_list` permission, the object-list endpoints return an **empty page (HTTP 200, silent
denial)**, not a 403. A 403 is only returned by the deprecated `/{id}/object` endpoints.
{% endhint %}

## Permission to feature mapping

| Feature | Required ObjectManagement | Required Object |
|---------|---------------------------|-----------------|
| See configuration in menu | `view_list` | - |
| View object list page | `view_list` | `view_list` |
| View object detail page | - | `view` |
| Object Management Select form.io component | - | `view_list` |
| Create new object | - | `create` |
| Edit object | - | `modify` |
| Delete object | - | `delete` |

{% hint style="info" %}
Admin pages (configuration management) are additionally gated by `ROLE_ADMIN` at the HTTP security level.
{% endhint %}

## Permission examples

<details>
<summary>Grant all users list access to all Object Management configurations</summary>

```json
[
  {
    "resourceType": "com.ritense.objectmanagement.domain.ObjectManagement",
    "action": "view_list",
    "roleKey": "ROLE_USER"
  }
]
```

</details>

<details>
<summary>Restrict list access to a specific configuration by title condition</summary>

```json
[
  {
    "resourceType": "com.ritense.objectmanagement.domain.ObjectManagement",
    "action": "view_list",
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
