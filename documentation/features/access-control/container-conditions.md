# Container conditions

Container conditions allow permissions to be scoped based on related entities. A `"type": "container"` condition
navigates from one resource type to another using an authorization entity mapper, and then applies conditions on the
related entity.

{% hint style="info" %}
The `CaseDefinition` container conditions described on this page are available from version **13.21.0** onwards.
{% endhint %}

## Using CaseDefinition as a container

Permissions can be scoped to a specific case definition by using `CaseDefinition` as a container. This is useful for
restricting access to resources based on the case they belong to.

The following example grants `ROLE_USER` permission to view and create documents only within the "bezwaar" case:

`document.permission.json`:

```json
[
    {
        "resourceType": "com.ritense.document.domain.impl.JsonSchemaDocument",
        "actions": ["view", "view_list", "create"],
        "roleKey": "ROLE_USER",
        "conditions": [
            {
                "type": "container",
                "resourceType": "com.ritense.case_.domain.definition.CaseDefinition",
                "conditions": [
                    {
                        "type": "field",
                        "field": "id.key",
                        "operator": "==",
                        "value": "bezwaar"
                    }
                ]
            }
        ]
    }
]
```

The `CaseDefinition` container resolves the case that a document belongs to — both for documents that are directly part
of a case (blueprint type CASE) and for documents inside building blocks.

## Scoping process instances to a case definition

Process instance (execution) permissions can also be scoped to a case definition. This controls which users can start or
interact with processes for specific cases. The mapper resolves the case definition through two paths: directly via the
process-document link, or via the document's business key.

`processinstance.permission.json`:

```json
[
    {
        "resourceType": "com.ritense.valtimo.operaton.domain.OperatonExecution",
        "action": "create",
        "roleKey": "ROLE_USER",
        "conditions": [
            {
                "type": "container",
                "resourceType": "com.ritense.case_.domain.definition.CaseDefinition",
                "conditions": [
                    {
                        "type": "field",
                        "field": "id.key",
                        "operator": "==",
                        "value": "bezwaar"
                    }
                ]
            }
        ]
    }
]
```

## Nesting containers

Container conditions can be nested to traverse multiple entity relationships. For example, to restrict note permissions
based on the case definition, the container chain goes from `Note` → `JsonSchemaDocument` → `CaseDefinition`:

`note.permission.json`:

```json
[
    {
        "resourceType": "com.ritense.note.domain.Note",
        "actions": ["modify", "delete"],
        "roleKey": "ROLE_USER",
        "conditions": [
            {
                "type": "field",
                "field": "createdByUserId",
                "operator": "==",
                "value": "${currentUsername}"
            },
            {
                "type": "container",
                "resourceType": "com.ritense.document.domain.impl.JsonSchemaDocument",
                "conditions": [
                    {
                        "type": "container",
                        "resourceType": "com.ritense.case_.domain.definition.CaseDefinition",
                        "conditions": [
                            {
                                "type": "field",
                                "field": "id.key",
                                "operator": "==",
                                "value": "bezwaar"
                            }
                        ]
                    }
                ]
            }
        ]
    }
]
```

This permission allows users to modify and delete only their own notes, and only for notes belonging to documents within
the "bezwaar" case.

## Available container relationships

The following table lists all container relationships available out of the box. Each row represents a
`"type": "container"` condition that can be used within permissions for the source resource type.

| Source resource type           | Container resource type        | Description                                                    |
|--------------------------------|--------------------------------|----------------------------------------------------------------|
| `JsonSchemaDocument`           | `CaseDefinition`               | Scope document permissions to a case definition                |
| `JsonSchemaDocument`           | `JsonSchemaDocumentDefinition` | Scope document permissions to a document definition            |
| `JsonSchemaDocumentDefinition` | `CaseDefinition`               | Scope document definition permissions to a case definition     |
| `OperatonExecution`            | `CaseDefinition`               | Scope process instance permissions to a case definition        |
| `OperatonExecution`            | `JsonSchemaDocument`           | Scope process instance permissions to document properties      |
| `OperatonProcessDefinition`    | `CaseDefinition`               | Scope process definition permissions to a case definition      |
| `OperatonTask`                 | `JsonSchemaDocument`           | Scope task permissions to document properties                  |
| `OperatonTask`                 | `OperatonIdentityLink`         | Scope task permissions to identity link properties             |
| `Note`                         | `JsonSchemaDocument`           | Scope note permissions to document properties                  |
| `CaseTab`                      | `JsonSchemaDocumentDefinition` | Scope case tab permissions to a document definition            |

Containers can be nested: if a mapper exists from A → B and from B → C, then a permission on A can use a B container
with a nested C container inside it.
