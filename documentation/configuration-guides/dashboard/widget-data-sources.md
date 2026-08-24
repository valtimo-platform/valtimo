# Widget data sources

A data source produces the numbers that a dashboard widget shows. The data sources below are included in Valtimo.

| Data source | Key | Front-end module |
|-------------|-----|------------------|
| [Case count](#case-count) | `case-count` | `CaseCountDataSourceModule` |
| [Task count](#task-count) | `task-count` | `TaskCountDataSourceModule` |
| [Multiple case counts](#multiple-case-counts) | `case-counts` | `CaseCountsDataSourceModule` |
| [Case group by](#case-group-by) | `case-group-by` | `CaseGroupByDataSourceModule` |

{% hint style="info" %}
Every data source that is used must be imported in the `AppModule` of the front-end implementation. The modules are exported from `@valtimo/dashboard`.
{% endhint %}

---

## Case count

Returns the number of cases of a specific case type that match the configured criteria.

| Property | Description |
|----------|-------------|
| `documentDefinition` | Required. The key of the document definition for which cases need to be counted |
| `queryConditions` | An array of conditions that a case needs to match in order to be included in the count |

### Query condition

| Property | Description |
|----------|-------------|
| `queryPath` | The path of the variable that the condition filters on |
| `queryOperator` | The operator used to compare (see [Operators](#operators)) |
| `queryValue` | The value that the `queryPath` variable is compared to |

---

## Task count

Returns the number of tasks that are visible to the user and match the configured criteria, together with the total number of tasks the user can see. Display types such as the gauge and the meter use that total to show the count as a part of the whole.

| Property | Description |
|----------|-------------|
| `caseDefinitionName` | Optional. When set, only tasks that belong to a case of this case type are counted. When omitted, tasks of all case types (and standalone tasks) are counted |
| `conditions` | Optional. An array of condition nodes that a task needs to match in order to be included in the count. A node is either a single condition or an `and`/`or` group. The nodes at the top level are combined with `AND` |

Both the count and the total that the widget compares it against are limited by `caseDefinitionName`. A widget that is limited to one case type therefore shows a part of the tasks of that case type, not a part of all tasks the user can see.

{% hint style="warning" %}
Filtering on a case type requires the `process-document` module, because that module resolves a task to the case it belongs to. Without it on the classpath, a widget that sets `caseDefinitionName` fails. Leaving the property out keeps the data source usable in applications without `process-document`.
{% endhint %}

### Condition groups

A condition node is one of:

| Node | Description |
|------|-------------|
| Condition | A single condition with a `path`, an `operator` and a `value` |
| `and` group | `{ "and": [ ...nodes ] }`. All child nodes have to match |
| `or` group | `{ "or": [ ...nodes ] }`. At least one child node has to match |

Groups can be nested to any depth, which makes it possible to count for example the tasks that are assigned **and** have one of two names.

The widget configuration in the admin screen mirrors this. Every group has its own list of conditions, an `AND`/`OR` selector, and an **Add condition group** button that adds a nested group. Because a group has a single operator, all sections within it are joined by that operator: the selector on the first connector between two sections sets it for the whole group, and the following connectors repeat it as text. To combine sections with different operators, put them in a group of their own.

{% hint style="info" %}
Conditions that the admin screen cannot show — an `in` condition with an array of values, or an operator that is not in the dropdown — are kept in the group they were configured in and can only be changed in the configuration file. The widget configuration shows a notification when a widget contains such conditions.
{% endhint %}

When a widget is saved from the admin screen, the tree is written back as a single root group, so `conditions` then holds one `and` or `or` node. A flat list of conditions, which is combined with `AND`, remains valid input.

### Example

```json
{
  "dataSourceKey": "task-count",
  "dataSourceProperties": {
    "caseDefinitionName": "bezwaar",
    "conditions": [
      {
        "path": "task:assignee",
        "operator": "!=",
        "value": "${null}"
      },
      {
        "or": [
          {
            "path": "task:name",
            "operator": "==",
            "value": "Beoordeel aanvraag"
          },
          {
            "path": "task:name",
            "operator": "==",
            "value": "Controleer documenten"
          }
        ]
      }
    ]
  }
}
```

{% hint style="info" %}
Existing task count configurations keep working without migration: the `queryConditions` property, the `queryPath`, `queryOperator` and `queryValue` aliases, and a flat list of conditions are all still valid.
{% endhint %}

---

## Multiple case counts

Returns several counts of cases of a specific case type, each with its own criteria.

| Property | Description |
|----------|-------------|
| `documentDefinition` | Required. The key of the document definition for which cases need to be counted |
| `queryItems` | Required. At least two need to be defined. Each `queryItem` requires a `label` and an array of `queryConditions`, the latter being the same as those of the `case-count` data source |

---

## Case group by

Returns the number of cases of a specific case type per value of a given path.

| Property | Description |
|----------|-------------|
| `documentDefinition` | Required. The key of the document definition for which cases need to be counted |
| `path` | Required. The path whose values need to be grouped, for example `case:createdBy` |
| `queryConditions` | Optional. An array of conditions that a case needs to match in order to be included in the counts. Each item is a query condition as described under [Case count](#case-count) |
| `enum` | Optional. An object that defines how the grouped values are displayed, so that technical values can be shown in a user-friendly way, for example `{"isRequired": "Is required"}` |

---

## Operators

| Operator | Description |
|----------|-------------|
| `==` | The value is equal to the configured value |
| `!=` | The value is not equal to the configured value |
| `>` | The value is greater than the configured value |
| `>=` | The value is greater than or equal to the configured value |
| `<` | The value is less than the configured value |
| `<=` | The value is less than or equal to the configured value |
| `in` | The value is one of the values in the configured array, for example `{ "path": "task:name", "operator": "in", "value": ["A", "B"] }`. A compact alternative to an `or` group of `==` conditions |
| `list_contains` | The value is a list that contains the configured value |

{% hint style="info" %}
The admin screen offers `==`, `!=`, `>`, `>=`, `<` and `<=`. The other operators can be configured in a configuration file.
{% endhint %}
