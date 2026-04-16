# Access control

{% hint style="success" %}
Available since Valtimo `12.10.0`. Document property conditions available since `13.25.0`.
{% endhint %}

Access to the documents that were uploaded to the case, can be configured through access control. More information about access control can be found [here](https://docs.valtimo.nl/features/access-control).

{% hint style="info" %}
`com.ritense.resource.authorization.ResourcePermission` is deprecated and automatically translated to `ZgwDocument` on save. Existing configurations continue to work unchanged.
{% endhint %}

### Resources and actions

<table><thead><tr><th width="329">Resource type</th><th width="143">Action</th><th>Effect</th></tr></thead><tbody><tr><td><code>com.ritense.documentenapi.authorization.ZgwDocument</code></td><td><code>view_list</code></td><td>Allows viewing the list of documents</td></tr><tr><td></td><td><code>view</code></td><td>Allows downloading a document</td></tr><tr><td></td><td><code>create</code></td><td>Allows uploading a document</td></tr><tr><td></td><td><code>modify</code></td><td>Allows modifying the metadata of a document</td></tr><tr><td></td><td><code>delete</code></td><td>Allows deleting a document</td></tr></tbody></table>

### Condition fields

The following fields can be used in `field` conditions on `ZgwDocument`:

| Field | Type | Description |
|---|---|---|
| `vertrouwelijkheidaanduiding` | `String` | Confidentiality level (e.g. `openbaar`, `geheim`) |
| `status` | `String` | Document status (e.g. `definitief`, `in_bewerking`) |
| `informatieobjecttypeUrl` | `String` | URL of the informatieobjecttype |
| `informatieobjecttypeOmschrijving` | `String` | Description of the informatieobjecttype |

{% hint style="warning" %}
The document list endpoint does not filter documents by these conditions — all documents for the case are returned. Per-document `canView` / `canModify` / `canDelete` flags are computed server-side and embedded in the list response. Single-document operations (view, download, modify, delete) enforce the full conditions.
{% endhint %}

### Examples

#### Permission to view all documents

```json
{
    "resourceType": "com.ritense.documentenapi.authorization.ZgwDocument",
    "action": "view_list",
    "conditions": []
}
```

#### Permission to view only public documents

```json
{
    "resourceType": "com.ritense.documentenapi.authorization.ZgwDocument",
    "action": "view",
    "conditions": [
        {
            "type": "field",
            "field": "vertrouwelijkheidaanduiding",
            "operator": "==",
            "value": "openbaar"
        }
    ]
}
```

#### Permission scoped to a case type using a container condition

```json
{
    "resourceType": "com.ritense.documentenapi.authorization.ZgwDocument",
    "actions": ["view_list", "view", "create", "modify", "delete"],
    "conditions": [
        {
            "type": "container",
            "resourceType": "com.ritense.document.domain.impl.JsonSchemaDocument",
            "conditions": [
                {
                    "type": "field",
                    "field": "documentDefinitionId.caseDefinitionId.key",
                    "operator": "in",
                    "value": ["bezwaar"]
                }
            ]
        }
    ]
}
```
