# Configuring conditions

Conditions can be used to further specify the policy on an element in Valtimo. When a condition is used in the policy it will match the conditions against the element it is trying to access. If the element matches the conditions it will be loaded, if a condition fails it will not be loaded.

{% hint style="info" %}
This page requires:

* Knowledge of [JSON](https://www.json.org/)
{% endhint %}

## Use case

**Use case:** An implementation has 5 case types. 2 of those 5 case types should only be accessible to managers.

**Solution:**

* Give the managers `ROLE_MANAGER`.
* Configure with conditions in PBAC that only `ROLE_MANAGER` can view these cases based on their Case Definition Name.
* Users without `ROLE_MANAGER` will no longer be able to view the 2 cases in Valtimo.

## Supported conditions

The following conditions can be used with their respective structures:

| Resource name                                          | Key          | Description                                                                                          |
| ------------------------------------------------------ | ------------ | ---------------------------------------------------------------------------------------------------- |
| [**Field**](configuring-conditions.md#field)           | `field`      | Allows conditions to be applied to specific fields.                                                  |
| [**Expression**](configuring-conditions.md#expression) | `expression` | Allows JsonPath expressions to search through JSON.                                                  |
| [**Container**](configuring-conditions.md#container)   | `container`  | Allows more complex conditions by denoting the related entity the nested conditions should apply to. |

### Field

| key        | Description                                     | Examples                                  |
| ---------- | ----------------------------------------------- | ----------------------------------------- |
| `type`     | The type of condition. In this case `field`.    | `field`                                   |
| `field`    | The field the value should be compared against. | `assigneeId`, `documentDefinitionId.name` |
| `operator` | The operator for the comparison.                | `==`, `<`                                 |
| `value`    | The value to compare the field against.         | `20000`, `${currentUserId}`               |

### Expression

| key        | Description                                       | Examples                    |
| ---------- | ------------------------------------------------- | --------------------------- |
| `type`     | The type of condition. In this case `expression`. | `expression`                |
| `field`    | The field used to start the path from.            | `content.content`           |
| `path`     | The path that points to the field to compare to.  | `$.height`                  |
| `operator` | The operator for the comparison.                  | `==`, `<`                   |
| `value`    | The value to compare the field against.           | `20000`, `${currentUserId}` |
| `clazz`    | The name of the class that is found at the path.  | `java.lang.Integer`         |

### Container

| key            | Description                                                      | Examples                                                                    |
| -------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `type`         | The type of condition. In this case `container`.                 | `container`                                                                 |
| `resourceType` | The related resource type the conditions should apply to.        | `com.ritense.document.domain.impl.JsonSchemaDocument`                       |
| `conditions`   | The conditions that should apply to the specified resource type. | See [supported conditions](configuring-conditions.md#supported-conditions). |

### Operators

| Operator        | Description                                             |
| --------------- | ------------------------------------------------------- |
| `==`            | Equal to.                                               |
| `!=`            | Not equal to.                                           |
| `>`             | Greater than.                                           |
| `>=`            | Greater than or equal to.                               |
| `<`             | Smaller than.                                           |
| `<=`            | Smaller than or equal to.                               |
| `list_contains` | Checks if a collection contains the given value.        |
| `in`            | Checks if a value is contained in the given collection. |

### Special values for the value field

| Value                 | Description                                  |
| --------------------- | -------------------------------------------- |
| `${currentUserId}`    | The identifier assigned to the current user. |
| `${currentUserEmail}` | The email address the current user has.      |
| `${currentUserRoles}` | The list of roles the current user has.      |

## Examples

Below a number of examples of applying conditions in Access control policies.

<details>

<summary>Expression permission with contains operator</summary>

In the example below, the `list_contains` operator is used to check if a specific flower is present inside the JsonSchemaDocument. Where the JsonSchemaDocument content could look like this: `{"flowers": ["lily", "rose", "daisy"]}`.

If the flower 'rose' is present in the JsonSchemaDocument, any user with the role `ROLE_USER` will be able to view that document.

{% code overflow="wrap" %}
```json
[
  {
    "resourceType": "com.ritense.document.domain.impl.JsonSchemaDocument",
    "action": "view_list",
    "roleKey": "ROLE_USER",
    "conditions": [
      {
        "type": "expression",
        "field": "content.content",
        "path": "$.flowers",
        "operator": "list_contains",
        "value": "rose",
        "clazz": "java.util.Collection"
      }
    ]
  }
]
```
{% endcode %}

</details>

<details>

<summary>Create case permissions</summary>

The following example demonstrates how to allow any user with `ROLE_USER` to create a case of type `leningen`. When trying to create a case, the case itself does not yet exist. So in order for conditions to be evaluated, they have to be defined based on the relation between the two resources,`JsonSchemaDocument` and `JsonSchemaDocumentDefinition`.

{% code overflow="wrap" %}
```json
[
  {
    "resourceType": "com.ritense.document.domain.impl.JsonSchemaDocument",
    "action": "create",
    "roleKey": "ROLE_USER",
    "conditions": [
      {
        "type": "container",
        "resourceType": "com.ritense.document.domain.impl.JsonSchemaDocumentDefinition",
        "conditions": [
          {
            "type": "field",
            "field": "id.name",
            "operator": "==",
            "value": "leningen"
          }
        ]
      }
    ]
  }
]
```
{% endcode %}

</details>

<details>

<summary>Create process instance permissions</summary>

The example below shows how to allow users with `ROLE_USER` to create a process instance of process definition type `GenericProces`. When trying to create a process instance, the execution itself does not yet exist. So in order for conditions to be evaluated, they have to be defined based on the relation between the two resources, `CamundaExecution` and `CamundaProcessDefinition`.

{% code overflow="wrap" %}
```json
[
  {
    "resourceType": "com.ritense.valtimo.camunda.domain.CamundaExecution",
    "action": "create",
    "roleKey": "ROLE_USER",
    "conditions": [
      {
        "type": "container",
        "resourceType": "com.ritense.valtimo.camunda.domain.CamundaProcessDefinition",
        "conditions": [
          {
            "type": "field",
            "field": "key",
            "operator": "==",
            "value": "GeneriekProces"
          }
        ]
      }
    ]
  }
]
```
{% endcode %}

</details>

<details>

<summary>User task candidate groups permissions</summary>

Access to a user task is usually controlled by setting the 'Candidate groups' to a role. To make sure that the user task candidate groups work together with PBAC, an additional permission should be set. The example below shows how that can be done.

{% code overflow="wrap" %}
```json
[
  {
    "resourceType": "com.ritense.valtimo.camunda.domain.CamundaTask",
    "action": "view_list",
    "roleKey": "ROLE_USER",
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
]
```
{% endcode %}

</details>

<details>

<summary>User task document property permissions</summary>

Access to a user task can be controlled based on properties inside the JsonSchemaDocument. The example below shows how that can be done.

{% code overflow="wrap" %}
```json
[
  {
    "resourceType": "com.ritense.valtimo.camunda.domain.CamundaTask",
    "action": "view_list",
    "roleKey": "ROLE_USER",
    "conditions": [
      {
        "type": "container",
        "resourceType": "com.ritense.document.domain.impl.JsonSchemaDocument",
        "conditions": [
          {
            "type": "expression",
            "field": "content.content",
            "path": "$.city",
            "operator": "==",
            "value": "Amsterdam",
            "clazz": "java.lang.String"
          }
        ]
      }
    ]
  }
]
```
{% endcode %}

</details>

<details>

<summary>Document content value is present in an array of values</summary>

```json
{
  "resourceType": "com.ritense.document.domain.impl.JsonSchemaDocument",
  "action": "view",
  "conditions": [
    {
      "type": "expression",
      "field": "content.content",
      "path": "$.city",
      "operator": "in",
      "value": ["Amsterdam", "Utrecht"],
      "clazz": "java.lang.String"
    }
  ]
}
```

</details>

<details>

<summary>The candidate group of a task is in the list of user roles</summary>

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
          "operator": "in",
          "value": "${currentUserRoles}"
        }
      ]
    }
  ]
}
```

</details>

<details>

<summary>Document content list value contains a specific value</summary>

```json
{
  "resourceType": "com.ritense.document.domain.impl.JsonSchemaDocument",
  "action": "view",
  "conditions": [
    {
      "type": "expression",
      "field": "content.content",
      "path": "$.cities",
      "operator": "list_contains",
      "value": "Amsterdam",
      "clazz": "java.lang.String"
    }
  ]
}
```

</details>
