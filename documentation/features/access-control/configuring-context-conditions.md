# Configuring context conditions

Context conditions can be used to further specify the policy on an element in Valtimo. When a condition is used in the policy it will match the conditions against the element it is trying to access. Context conditions are restrictions on top of those, to define policies that only work within the context of another resource.

{% hint style="info" %}
This page requires:

* Knowledge of [JSON](https://www.json.org/)
{% endhint %}

## Use case

**Use case:** An implementation has 5 case types. Financial advisors should only be able to start processes for cases of 1 case type.

**Solution:**

* Give the financial advisors `ROLE_FINANCIAL`.
* Configure with conditions in PBAC that only `ROLE_FINANCIAL` can start processes, within the context of cases with a specific case definition name.

## Example

<details>

<summary>Permission with context condition</summary>

In the example below, a junior financial advisor is only allowed to start an intake processes for clients who have less than 5000 euros to their name.

{% code overflow="wrap" %}
```json
[
    {
        "resourceType": "com.ritense.valtimo.camunda.domain.CamundaExecution",
        "action": "create",
        "roleKey": "ROLE_JR_FINANCIAL",
        "conditions": [
            {
                "type": "container",
                "resourceType": "com.ritense.valtimo.camunda.domain.CamundaProcessDefinition",
                "conditions": [
                    {
                        "type": "field",
                        "field": "key",
                        "operator": "==",
                        "value": "intake-process"
                    }
                ]
            }
        ],
        "contextResourceType": "com.ritense.document.domain.impl.JsonSchemaDocument",
        "contextConditions": [
            {
                "type": "expression",
                "field": "content.content",
                "path": "$.funds",
                "operator": "<",
                "value": 5000,
                "clazz": "java.lang.Integer"
            }
        ]
    }
]
```
{% endcode %}

#### Using the NoContext option

The context option can be used to specify permissions for cases where certain context is provided. But sometimes you want to specify permissions for cases where no context is provided. This can't be accomplished by leaving out the contextResourceType, because it will then match any context.

In order to configure permissions for cases where no context is provided, the NoContext option can be used. This can be done by setting the contextResourceType to `com.ritense.authorization.NoContext`. This is a stand in for any permission check that does not explicitly provide context.

</details>
