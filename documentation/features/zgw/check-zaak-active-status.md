# Check zaak active status

{% hint style="success" %}
Available since Valtimo `13.21.0`
{% endhint %}

Valtimo provides an API endpoint to check whether a zaak is still active. A zaak is considered active when its `einddatum` (end date) has not been set.

## API

### Endpoint

```
GET /api/v1/zaken-api/zaak/{zaakIdentificatie}/actief
```

### Parameters

| Parameter              | Type   | Required | Description                                                                                          |
|------------------------|--------|----------|------------------------------------------------------------------------------------------------------|
| `zaakIdentificatie`    | String | Yes      | The identificatie of the zaak to check.                                                              |
| `zaken_api_plugin_id`  | UUID   | No       | The ID of a specific Zaken API plugin configuration to use. If omitted, all configured Zaken API plugins are searched. |

### Responses

| Status | Description                                                                 |
|--------|-----------------------------------------------------------------------------|
| 200    | Returns `{ "actief": true }` or `{ "actief": false }`.                     |
| 404    | No authorized zaak was found for the given identificatie.                   |
| 409    | More than one authorized zaak was found for the given identificatie.        |

## Access control

This endpoint is secured with PBAC. A new resource type `com.ritense.zakenapi.security.Zaak` is available with the following action:

| Action               | Description                                      |
|----------------------|--------------------------------------------------|
| `view_active_status` | Allows checking the active status of a zaak.     |

The resource supports a `zaaktype` field condition, so access can be restricted to specific zaaktypen.

### Example permission configuration

```json
[
    {
        "resourceType": "com.ritense.zakenapi.security.Zaak",
        "action": "view_active_status",
        "roleKey": "ROLE_USER",
        "conditions": [
            {
                "type": "field",
                "field": "zaaktype",
                "operator": "==",
                "value": "http://localhost:8001/catalogi/api/v1/zaaktypen/my-zaaktype-uuid"
            }
        ]
    }
]
```

This configuration grants users with the `ROLE_USER` role permission to check the active status of zaken that match the specified zaaktype.
