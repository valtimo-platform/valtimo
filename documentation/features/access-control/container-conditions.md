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

## Scoping case list exports (the `export` action)

The `export` action on `JsonSchemaDocument` controls the CSV export ("download") of a case list. A role can export when
it has an `export` permission that applies, and the exported file contains exactly the documents that match the
permission's conditions.

You can scope an export permission in two complementary ways, and combine them freely (all conditions must hold — AND):

* **By case definition** — wrap the condition in a `JsonSchemaDocumentDefinition` (or `CaseDefinition`) container. This
  makes the export/download button appear on precisely the case lists the role is allowed to export, and scopes the
  exported rows to that case.
* **To a subset of documents** — add `field` or `expression` conditions to narrow which documents end up in the CSV, for
  example only documents assigned to the current user, only documents with a certain status, or matching a value in the
  case content. These are applied as row filters on the export query, so the file contains only the matching documents.

### Export a specific case

Grants `ROLE_ANALYSE` permission to export the "erfpachtbeheer" case. The download button appears on that case list, and
the export contains its documents:

`document.permission.json`:

```json
[
    {
        "resourceType": "com.ritense.document.domain.impl.JsonSchemaDocument",
        "action": "export",
        "roleKey": "ROLE_ANALYSE",
        "conditions": [
            {
                "type": "container",
                "resourceType": "com.ritense.document.domain.impl.JsonSchemaDocumentDefinition",
                "conditions": [
                    {
                        "type": "field",
                        "field": "id.name",
                        "operator": "==",
                        "value": "erfpachtbeheer"
                    }
                ]
            }
        ]
    }
]
```

### Limit the export to a subset of documents

Building on the previous example, this additionally restricts the export to documents assigned to the current user. The
button still appears on the "erfpachtbeheer" list, and the CSV contains only that user's cases:

`document.permission.json`:

```json
[
    {
        "resourceType": "com.ritense.document.domain.impl.JsonSchemaDocument",
        "action": "export",
        "roleKey": "ROLE_ANALYSE",
        "conditions": [
            {
                "type": "container",
                "resourceType": "com.ritense.document.domain.impl.JsonSchemaDocumentDefinition",
                "conditions": [
                    {
                        "type": "field",
                        "field": "id.name",
                        "operator": "==",
                        "value": "erfpachtbeheer"
                    }
                ]
            },
            {
                "type": "field",
                "field": "assigneeId",
                "operator": "==",
                "value": "${currentUserId}"
            }
        ]
    }
]
```

Row-level `field` and `expression` conditions can scope on any authorizable property of the document — for example
`internalStatus.id.key` (status), `assignedTeamKey` (team), or a value inside the case content via an `expression`
condition on `content.content`.

{% hint style="info" %}
Use a container to scope by case: it is what makes the download button appear on the case lists the role can export.
Row-level `field`/`expression` conditions then narrow which documents are included in the file.
{% endhint %}

A column must also be marked `"exportable": true` in the case list configuration for it to be included in the export —
see [Case list](../case/case-list/list.md).

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
| `OperatonTimer`                | `OperatonExecution`            | Scope timer permissions to the process instance                |
| `Note`                         | `JsonSchemaDocument`           | Scope note permissions to document properties                  |
| `CaseTab`                      | `JsonSchemaDocumentDefinition` | Scope case tab permissions to a document definition            |

Containers can be nested: if a mapper exists from A → B and from B → C, then a permission on A can use a B container
with a nested C container inside it.
