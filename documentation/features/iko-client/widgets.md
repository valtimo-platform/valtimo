# Widgets

Configure data display widgets within tabs.

## Overview

Widgets are the building blocks of a Tab and display the actual data. Each widget can be configured with a specific type, layout, and data mapping. Widgets can also have display conditions to control when they are shown.

## Widget types

| Type | Description | Example use |
|------|-------------|-------------|
| `fields` | Key-value fields in columns | Customer data, Address |
| `collection` | List of items with pagination | Nationalities, Partners |
| `table` | Data in table format | Contact moments |
| `interactive-table` | Table with sorting and filtering | Running cases |
| `map` | Geographic map display | Location |
| `divider` | Visual separation | Grouping widgets |

## Configuration

{% tabs %}
{% tab title="Via UI" %}

### Widget configuration wizard

The widget configuration goes through 6 steps:

#### Step 1: Choose widget type

Select from: Fields, Collection, Table, Interactive table, Map, or Divider.

#### Step 2: Choose widget width

| Option | Description |
|--------|-------------|
| Small | 1 column width |
| Medium | 2 columns width |
| Large | 3 columns width |
| Extra large | Full width (4 columns) |

#### Step 3: Choose widget density

| Option | Description |
|--------|-------------|
| Default | Normal spacing between elements |
| Compact | Compact display with reduced spacing |

#### Step 4: Choose widget style

| Option | Description |
|--------|-------------|
| Default | Normal display for regular content |
| High contrast | Emphasized display with dark background for priority content |

#### Step 5: Choose widget content

Configure the widget title, icon, actions, and field columns.

#### Step 6: Set display conditions

Configure conditions that determine when the widget is shown.

### Widget order and dividers

The order of widgets within a tab can be adjusted via drag & drop. A **divider** can be added to visually separate groups of widgets.

### Visual Editor vs JSON Editor

Widgets can be configured via:

- **Visual editor** - Graphical interface using the wizard
- **JSON editor** - Direct JSON editing for advanced configuration

{% endtab %}

{% tab title="Via IDE" %}

Widgets can be configured through autodeployment. See [For developers](for-developers.md) for complete JSON schemas and examples for each widget type.

**Basic widget structure** (`*.iko-widget.json`):

```json
{
  "ikoViewKey": "customer",
  "ikoTabKey": "general",
  "ikoWidgets": [
    {
      "type": "fields",
      "key": "personal-data",
      "title": "Personal Data",
      "width": 2,
      "highContrast": true,
      "isCompact": false,
      "actions": [],
      "displayConditions": [],
      "properties": {
        "columns": [
          [
            {
              "key": "name",
              "title": "Name",
              "value": "iko:/person/name/fullName"
            }
          ]
        ]
      }
    }
  ]
}
```

{% endtab %}
{% endtabs %}

## Widget content properties

| Field | Description |
|-------|-------------|
| Widget title | Title displayed above the widget |
| Icon | Optional icon |
| Target URL (with placeholders) | Link URL with placeholders for actions |
| Button label | Text on action buttons |
| Columns | Columns containing fields |

### Field properties

| Field | Description |
|-------|-------------|
| Key | Technical key (unique identifier) |
| Title | Field label |
| Value | Data path (e.g. `iko:/person/name/fullName`) |
| Display type | Text, Date, Date and time, Currency, Yes/No |
| Ellipsis character limit | Maximum characters before truncation (optional) |
| Hide when empty | Hide field when value is empty |

## Display conditions

Display conditions determine when a widget is shown based on data values.

| Field | Description |
|-------|-------------|
| Path | Data path for the condition |
| Operator | Comparison operator (e.g. "==", "Equal to") |
| Value | Value to compare against |

{% hint style="info" %}
Multiple conditions can be added to a widget. All conditions must be met for the widget to display.
{% endhint %}

## Display properties

| Type | Parameters | Description |
|------|------------|--------------|
| `text` | `hideWhenEmpty` | Standard text display |
| `number` | `hideWhenEmpty` | Numeric display |
| `date` | `format`, `hideWhenEmpty` | Date display |
| `datetime` | `format`, `hideWhenEmpty` | Date and time display |
| `boolean` | `hideWhenEmpty` | Yes/No display |
| `currency` | `hideWhenEmpty` | Currency display |
| `percent` | `hideWhenEmpty` | Percentage display |
| `link` | `hideWhenEmpty` | Hyperlink display |

### Date formats

| Pattern | Description | Example |
|---------|-------------|---------|
| `DD-MM-YYYY` | Day-Month-Year | 31-12-2024 |
| `YYYY-MM-DD` | Year-Month-Day | 2024-12-31 |
| `DD/MM/YYYY` | Day/Month/Year | 31/12/2024 |

## Value resolvers

Values in widgets are retrieved via value resolvers. The `iko:` prefix indicates the value should be retrieved from the IKO context.

| Pattern | Description |
|---------|-------------|
| `iko:/path/to/field` | Absolute path from the root context |
| `/path/to/field` | Relative path within a collection item |

## Widget actions

Widgets can contain actions that users can execute.

| Type | Description |
|------|-------------|
| `createNewCase` | Start a new case |
| `startProcess` | Start a process |
| `navigateTo` | Navigate to another page |

## Related

* [Tabs](tabs.md)
* [For developers](for-developers.md)
