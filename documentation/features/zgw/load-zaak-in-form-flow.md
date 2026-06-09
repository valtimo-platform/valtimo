# Load a zaak in a form flow

{% hint style="success" %}
Available since Valtimo `13.32.0`
{% endhint %}

Valtimo provides a [form flow](../case/form-flow.md) bean to load a zaak from the Zaken API. The bean returns the full zaak, so the implementer can use whatever information is relevant for their flow.

## Form flow bean

The `zakenFormFlow` bean exposes a `getZaak` method that retrieves a zaak by its `identificatie`. The method is available in form flow SpEL expressions (for example `onOpen` or `onComplete`).

### Method signatures

| Method                                         | Description                                                                                    |
|------------------------------------------------|------------------------------------------------------------------------------------------------|
| `getZaak(zaakIdentificatie)`                   | Retrieves the zaak with the given `identificatie`, searching all configured Zaken API plugins. |
| `getZaak(zaakIdentificatie, zakenApiPluginId)` | Retrieves the zaak using a specific Zaken API plugin configuration, identified by its UUID.    |

### Parameters

| Parameter           | Type   | Required | Description                                                                                                            |
|---------------------|--------|----------|------------------------------------------------------------------------------------------------------------------------|
| `zaakIdentificatie` | String | Yes      | The `identificatie` of the zaak to load.                                                                               |
| `zakenApiPluginId`  | UUID   | No       | The ID of a specific Zaken API plugin configuration to use. If omitted, all configured Zaken API plugins are searched. |

### Return value

The method returns the full `ZaakResponse` object, or `null` when no authorized zaak is found for the given `identificatie`. All fields of the zaak are available, so the implementer can read whatever information is relevant for their flow.

If more than one authorized zaak is found for the given `identificatie`, a `MultipleZakenFoundException` is thrown.

### Example usage

The following form flow step loads a zaak on completion and stores it in the submission data, so a later step (or condition) can use its fields:

```json
{
    "key": "step1",
    "nextSteps": [{ "step": "step2" }],
    "onComplete": ["${step.submissionData.zaak = zakenFormFlow.getZaak(\"ZAAK-2026-0000000001\")}"],
    "type": {
        "name": "form",
        "properties": {
            "definition": "my-form"
        }
    }
}
```

Any field of the loaded zaak can then be referenced from the submission data. For instance, a condition can check whether the zaak is active by testing the `einddatum`:

```json
"condition": "${step.submissionData.zaak.einddatum == null}"
```

## Access control

Loading a zaak through this bean is secured with PBAC. A resource type `com.ritense.zakenapi.security.Zaak` is available with the following action:

| Action               | Description            |
|----------------------|------------------------|
| `view_active_status` | Allows loading a zaak. |

When loading a zaak, only zaken the user is authorized to view are returned. If no authorized zaak matches the `identificatie`, the bean returns `null`.

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

This configuration grants users with the `ROLE_USER` role permission to load zaken that match the specified zaaktype.
