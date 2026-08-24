# Configurable elements

This page lists all resources and actions available for access control configuration. Each resource type can have permissions configured with specific actions.

---

## Resources

### Core

| Display name | Resource type | Actions |
|--------------|---------------|---------|
| Case | `com.ritense.document.domain.impl.JsonSchemaDocument` | `view`, `view_list`, `create`, `modify`, `delete`, `claim`, `assign`, `assignable`, `export`, `inspect`, `inspect_modify` |
| CaseDefinition | `com.ritense.case_.domain.definition.CaseDefinition` | `view`, `view_list` |
| CaseTab | `com.ritense.case.domain.CaseTab` | `view` |
| CaseWidgetTabWidget | `com.ritense.case_.domain.tab.CaseWidgetTabWidget` | `view` |
| Dashboard | `com.ritense.dashboard.domain.Dashboard` | `view`, `view_list` |
| JsonSchemaDocumentDefinition | `com.ritense.document.domain.impl.JsonSchemaDocumentDefinition` | `view`, `view_list`, `create`, `modify`, `delete` |
| JsonSchemaDocumentSnapshot | `com.ritense.document.domain.impl.snapshot.JsonSchemaDocumentSnapshot` | `view`, `view_list` |
| Note | `com.ritense.note.domain.Note` | `view_list`, `create`, `modify`, `delete` |
| OperatonExecution | `com.ritense.valtimo.operaton.domain.OperatonExecution` | `create` |
| OperatonTask | `com.ritense.valtimo.operaton.domain.OperatonTask` | `view`, `view_list`, `assign`, `assignable`, `claim`, `complete` |
| ResourcePermission | `com.ritense.resource.domain.ResourcePermission` | `view`, `view_list`, `create`, `modify`, `delete` |
| SearchField | `com.ritense.document.domain.search.SearchField` | `view_list` |
| Team | `com.ritense.team.domain.Team` | `view`, `view_list`, `create`, `modify`, `delete`, `assign` |
| User | `com.valtimo.keycloak.domain.User` | `view`, `view_list` |

### ZGW

| Display name | Resource type | Actions |
|--------------|---------------|---------|
| Object | `com.ritense.objectenapi.domain.Object` | `view`, `view_list`, `create`, `modify`, `delete` |
| ObjectManagement | `com.ritense.objectmanagement.domain.ObjectManagement` | `view_list` |
| Zaak | `com.ritense.zakenapi.domain.Zaak` | `view` |
| ZgwDocument | `com.ritense.documentenapi.domain.ZgwDocument` | `view`, `view_list`, `create`, `modify`, `delete` |

---

## Actions

| Action | Description |
|--------|-------------|
| `view` | View a single resource |
| `view_list` | View a list of resources |
| `create` | Create a new resource |
| `modify` | Modify an existing resource |
| `delete` | Delete a resource |
| `claim` | Claim a resource (e.g., claim a task or case) |
| `assign` | Assign a resource to another user |
| `assignable` | Appear in assignee dropdowns |
| `complete` | Complete a task |
| `export` | Export a resource |
| `inspect` | View document data in the inspector |
| `inspect_modify` | Modify document data via the inspector |

---

## Resource descriptions

### Case (JsonSchemaDocument)

The main case entity. Controls what users can do with individual cases.

| Action | Effect |
|--------|--------|
| `view` | View case details |
| `view_list` | View cases in the case list |
| `create` | Create new cases |
| `modify` | Update case data |
| `delete` | Delete cases |
| `claim` | Claim a case for yourself |
| `assign` | Assign a case to another user |
| `assignable` | Appear as an option in the assignee dropdown |
| `export` | Export case data |
| `inspect` | View raw case data in the inspector tab |
| `inspect_modify` | Edit raw case data in the inspector tab |

### Task (OperatonTask)

User tasks from running processes.

| Action | Effect |
|--------|--------|
| `view` | View task details |
| `view_list` | View tasks in task lists |
| `claim` | Claim a task for yourself |
| `assign` | Assign a task to another user |
| `assignable` | Appear as an option in the assignee dropdown |
| `complete` | Complete a task |

### Process execution (OperatonExecution)

Controls who can start processes.

| Action | Effect |
|--------|--------|
| `create` | Start a new process instance |

### Dashboard

Dashboard visibility.

| Action | Effect |
|--------|--------|
| `view` | View dashboard content |
| `view_list` | See dashboard in the navigation |

### Note

Case notes/comments.

| Action | Effect |
|--------|--------|
| `view_list` | View notes on a case |
| `create` | Add notes to a case |
| `modify` | Edit existing notes |
| `delete` | Delete notes |

### Team

Team management.

| Action | Effect |
|--------|--------|
| `view` | View team details |
| `view_list` | View list of teams |
| `create` | Create new teams |
| `modify` | Edit team settings |
| `delete` | Delete teams |
| `assign` | Assign users to teams |

---

## Context resources

Some resources support [context conditions](context-conditions.md), which restrict permissions based on how the resource is accessed. When a resource is accessed within the scope of a case, permissions can be configured to apply only in that context.

| Resource | Actions | Context resource | Use case |
|----------|---------|------------------|----------|
| CaseTab | `view` | Case | Viewing tabs within a specific case |
| CaseWidgetTabWidget | `view` | Case | Viewing widgets within a specific case |
| OperatonExecution | `create` | Case | Starting processes within a specific case |

All context resources are `Case` (`JsonSchemaDocument`). Context conditions are evaluated when resources are accessed from within a case, such as viewing case tabs or starting a process from the case details page.
