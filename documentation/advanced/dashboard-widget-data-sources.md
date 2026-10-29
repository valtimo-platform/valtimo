# Dashboard widget data sources

This document describes the data sources that a dashboard widget can use and the properties each of them accepts.

> **Audience:** This guide is intended for power users and system administrators who configure widgets through the JSON editor of a dashboard or through a dashboard configuration file, instead of through the widget screens described in [Widgets](../configuration-guides/dashboard/widgets.md).

## Overview

A data source produces the numbers that a widget shows. The data sources below are included in Valtimo.

| Data source | Key | Front-end module |
|-------------|-----|------------------|
| [Case count](#case-count) | `case-count` | `CaseCountDataSourceModule` |
| [Task count](#task-count) | `task-count` | `TaskCountDataSourceModule` |
| [Multiple case counts](#multiple-case-counts) | `case-counts` | `CaseCountsDataSourceModule` |
| [Case group by](#case-group-by) | `case-group-by` | `CaseGroupByDataSourceModule` |

Every data source that is used must be imported in the `AppModule` of the front-end implementation. The modules are exported from `@valtimo/dashboard`.

A widget declares its data source with `dataSourceKey` and configures it with `dataSourceProperties`:

```json
{
  "dataSourceKey": "task-count",
  "dataSourceProperties": {},
  "displayType": "gauge",
  "displayTypeProperties": {}
}
```

## Case count

Returns the number of cases of one document definition that match the configured criteria.

| Property | Type | Description |
|----------|------|-------------|
| `documentDefinition` | string | Required. The key of the document definition for which cases are counted |
| `queryConditions` | array | Conditions a case has to match to be included in the count |

### Query condition

| Property | Type | Description |
|----------|------|-------------|
| `queryPath` | string | The path of the field the condition applies to |
| `queryOperator` | string | The comparison to make, see [Operators](#operators) |
| `queryValue` | any | The value the field is compared to |

## Task count

Returns the number of tasks that are visible to the user and match the configured criteria, together with the total number of tasks that user can see. Display types such as the gauge and the meter use that total to show the count as a part of the whole.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `caseDefinitionName` | string | none | Optional. When set, only tasks that belong to a case of this case definition are counted. When omitted, tasks of all case definitions, including standalone tasks, are counted |
| `conditions` | array | `[]` | Optional. Condition nodes a task has to match to be included in the count. A node is either a single condition or an `and`/`or` group. The nodes at the top level are combined with `AND` |

Both the count and the total that the widget compares it against are limited by `caseDefinitionName`.

{% hint style="warning" %}
`caseDefinitionName` requires the `process-document` module on the classpath, which contributes the bean that resolves a task to its case. Without that module, a widget that sets the property fails. Leaving the property out keeps the data source usable in applications without `process-document`.
{% endhint %}

### Condition nodes

| Node | Shape | Description |
|------|-------|-------------|
| Condition | `{ "path": ..., "operator": ..., "value": ... }` | A single condition |
| `and` group | `{ "and": [ ...nodes ] }` | All child nodes have to match |
| `or` group | `{ "or": [ ...nodes ] }` | At least one child node has to match |

Groups can be nested to any depth. When a widget is saved from the widget screen, the tree is written back as a single root group, so `conditions` then holds one `and` or `or` node. A flat list of conditions, which is combined with `AND`, remains valid input.

Conditions that the widget screen cannot render — an `in` condition with an array value, or an operator outside the dropdown of that screen — are kept in the group they were configured in and can only be changed in JSON.

## Multiple case counts

Returns several counts of cases of one document definition, each with its own criteria.

| Property | Type | Description |
|----------|------|-------------|
| `documentDefinition` | string | Required. The key of the document definition for which cases are counted |
| `queryItems` | array | Required. At least two items. Each item requires a `label` and an array of `queryConditions`, the latter being the same as those of the `case-count` data source |

## Case group by

Returns the number of cases of one document definition per value of a given path.

| Property | Type | Description |
|----------|------|-------------|
| `documentDefinition` | string | Required. The key of the document definition for which cases are counted |
| `path` | string | Required. The path whose values are grouped, for example `case:createdBy` |
| `queryConditions` | array | Optional. Conditions a case has to match to be included in the counts, as described under [Case count](#case-count) |
| `enum` | object | Optional. Defines how the grouped values are displayed, so that technical values can be shown in a readable way, for example `{"isRequired": "Is required"}` |

## Operators

| Operator | Description |
|----------|-------------|
| `==` | The field is equal to the value |
| `!=` | The field is not equal to the value |
| `>` | The field is greater than the value |
| `>=` | The field is greater than or equal to the value |
| `<` | The field is less than the value |
| `<=` | The field is less than or equal to the value |
| `in` | The field is one of the values in an array, a compact alternative to an `or` group of `==` conditions |
| `list_contains` | The field is a list that contains the value |

The widget screens offer `==`, `!=`, `>`, `>=`, `<` and `<=`. The other operators can only be configured in JSON.

A value between `${` and `}` is evaluated as an expression, which makes `"value": "${null}"` the way to compare a field to no value at all.

## Examples

### Assigned tasks of one case definition with one of two names

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

### The same count with the `in` operator

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
        "path": "task:name",
        "operator": "in",
        "value": ["Beoordeel aanvraag", "Controleer documenten"]
      }
    ]
  }
}
```

{% hint style="info" %}
Task count configurations from earlier versions keep working without migration: the `queryConditions` property, the `queryPath`, `queryOperator` and `queryValue` aliases, and a flat list of conditions are all still valid.
{% endhint %}

## Related

- [Widgets](../configuration-guides/dashboard/widgets.md) — Configuring widgets through the admin screens
- [Dashboard](../configuration-guides/dashboard/README.md) — Configuring dashboards
