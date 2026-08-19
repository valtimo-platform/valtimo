# Widget data sources

The data sources listed below are the ones that are included in Valtimo.

Each data source used must be imported in the `AppModule` of your front-end implementation if you want to use them. They are exported from `'@valtimo/dashboard'`.

## Case count

Key: `case-count`

Front-end module: `CaseCountDataSourceModule`

Returns the number of cases of a specific type that match the criteria have been set in the configuration.

### Properties

<table><thead><tr><th valign="top">Name</th><th valign="top">Description</th></tr></thead><tbody><tr><td valign="top"><code>documentDefinition</code></td><td valign="top">Required. The key of the document definition for which cases need to be counted.</td></tr><tr><td valign="top"><code>queryConditions</code></td><td valign="top">An array of conditions that the case needs to match in order to be included in the count. Each item in the array is a query condition object described in the table below.</td></tr></tbody></table>

### Query condition

<table><thead><tr><th valign="top">Name</th><th valign="top">Description</th></tr></thead><tbody><tr><td valign="top"><code>queryPath</code></td><td valign="top">The path of the variable that the condition uses to filter the count.</td></tr><tr><td valign="top"><code>queryOperator</code></td><td valign="top">The operator that the condition uses to filter the count. Available values are <code>!=</code>, <code>==</code>, <code>></code>, <code>>=</code>, <code>&#x3C;</code> and <code>&#x3C;=</code>.</td></tr><tr><td valign="top"><code>queryValue</code></td><td valign="top">The value which the queryPath variable is checked against.</td></tr></tbody></table>

## Task count <a href="#task-count" id="task-count"></a>

Key: `task-count`

Front-end module: `TaskCountDataSourceModule`

Returns the number of tasks that are visible to the user and match the criteria set in the configuration.

### Properties

<table><thead><tr><th valign="top">Name</th><th valign="top">Description</th></tr></thead><tbody><tr><td valign="top"><code>caseDefinitionName</code></td><td valign="top">Optional. When set, only tasks that belong to a case of this case definition are counted. When omitted, tasks of all case definitions (and standalone tasks) are counted.</td></tr><tr><td valign="top"><code>conditions</code></td><td valign="top">Optional. An array of condition nodes that a task needs to match in order to be included in the count. A node is either a single condition or an <code>and</code>/<code>or</code> group (see below). The nodes at the top level are combined with <code>AND</code>.</td></tr></tbody></table>

Note that both the filtered count and the total the widget compares it against are scoped by
`caseDefinitionName`. A widget with `caseDefinitionName` set therefore shows a percentage relative
to the tasks of that case definition, not relative to all tasks the user can see.

{% hint style="warning" %}
Filtering on `caseDefinitionName` requires the `process-document` module, which contributes the
`TaskCaseDefinitionSpecificationFactory` bean that resolves a task to its case. Without that module
on the classpath, a widget that sets `caseDefinitionName` fails with an `IllegalStateException`.
Leaving the property out keeps the data source usable in applications without `process-document`.
{% endhint %}

### Condition node

A condition node is one of:

* **A single condition** — the same object used by the `case-count` data source, with `path`, `operator` and `value`. The legacy aliases `queryPath`, `queryOperator` and `queryValue` remain valid.
* **An `and` group** — `{ "and": [ ...nodes ] }`. All child nodes must match.
* **An `or` group** — `{ "or": [ ...nodes ] }`. At least one child node must match.

Groups may be nested to arbitrary depth. The admin UI mirrors this: every group has an `AND`/`OR` selector, its own list of conditions, and an **Add condition group** button that appends a section. Conditions that the editor cannot represent (`in` conditions with an array value, or operators outside the dropdown) are preserved in the group they were configured in when the widget is edited in the UI, but can only be changed through the configuration file.

The UI writes the tree back as a single root group, so `conditions` holds one `and`/`or` node after a widget has been saved from the admin UI. A flat list of conditions (implicitly combined with `AND`) remains valid input.

Because a group has one operator, the sections at the same level are always joined by that same operator: the UI shows a selector on the first connector between them and repeats the chosen operator as plain text on the following connectors. To combine sections with different operators, nest them in a group of their own.

The connector is the only place where that operator is set. **Add condition group** just appends a section: the way the sections relate belongs to the group, not to the section being added, and a section carries its own `AND`/`OR` for the conditions inside it - two different levels that would be easy to confuse if the button asked as well. A group starts out combining its sections with `AND`, which the selector on the connector changes for the whole group at once.

### Operators

In addition to the operators available for `case-count` (`!=`, `==`, `>`, `>=`, `<`, `<=`), the `task-count` conditions support:

<table><thead><tr><th valign="top">Operator</th><th valign="top">Description</th></tr></thead><tbody><tr><td valign="top"><code>in</code></td><td valign="top">Matches when the field value is one of the values in the provided array, e.g. <code>{ "path": "task:name", "operator": "in", "value": ["A", "B"] }</code>. This is a compact alternative to an <code>or</code> group of <code>==</code> conditions.</td></tr></tbody></table>

### Example

```json
{
  "dataSourceKey": "task-count",
  "dataSourceProperties": {
    "caseDefinitionName": "leerlingzaken",
    "conditions": [
      { "path": "task:assignee", "operator": "!=", "value": "${null}" },
      { "or": [
          { "path": "task:name", "operator": "==", "value": "Beoordeel aanvraag" },
          { "path": "task:name", "operator": "==", "value": "Controleer documenten" }
      ]},
      { "path": "task:name", "operator": "in", "value": ["A", "B"] }
    ]
  }
}
```

{% hint style="info" %}
**Backwards compatible.** Existing `task-count` configurations keep working without migration: the legacy `queryConditions` property, the `queryPath`/`queryOperator`/`queryValue` aliases, and a flat list of conditions (implicitly combined with `AND`) are all still valid.
{% endhint %}

## Multiple case counts <a href="#multiple-case-counts" id="multiple-case-counts"></a>

Key: `case-counts`

Front-end module: `CaseCountsDataSourceModule`

Returns multiple counts of cases of a specific type that match the criteria have been set for each count.

### **Properties**

<table><thead><tr><th valign="top">Name</th><th valign="top">Description</th></tr></thead><tbody><tr><td valign="top"><code>documentDefinition</code></td><td valign="top">Required. The key of the document definition for which cases need to be counted.</td></tr><tr><td valign="top"><code>queryItems</code></td><td valign="top">Required. Minimum of two need to be defined. Each <code>queryItem</code> requires a <code>label</code> and an array of <code>queryConditions</code>, the latter are similar to those require for the <code>case-count</code> data source.</td></tr></tbody></table>

## Case group by <a href="#case-group-by" id="case-group-by"></a>

Key: `case-group-by`

Front-end module: `CaseGroupByDataSourceModule`

### Properties

<table><thead><tr><th valign="top">Name</th><th valign="top">Description</th></tr></thead><tbody><tr><td valign="top"><code>documentDefinition</code></td><td valign="top">Required. The key of the document definition for which cases need to be counted.</td></tr><tr><td valign="top"><code>path</code></td><td valign="top">Required. The path of which the values need to be grouped. For example <code>case:createdBy</code>.</td></tr><tr><td valign="top"><code>queryConditions</code></td><td valign="top">Optional. An array of conditions that the case needs to match in order to be included in the counts. Each item in the array is a query condition object described in the table under <code>case-count</code>.</td></tr><tr><td valign="top"><code>enum</code></td><td valign="top">Optional. An object which defines how items retrieved by the group by need to be displayed. This can be used to show technical values in a user-friendly way. For example <code>{"isRequired": "Is required"}</code>.</td></tr></tbody></table>
