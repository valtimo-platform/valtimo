# Widgets

Configure data display widgets within tabs.

## Overview

Widgets display the actual data within a tab. Each widget can be configured with a specific type, layout, and data mapping. Widgets can also have display conditions to control when they are shown, and actions to allow users to perform operations.

The detail screen is divided into 4 columns. Each widget occupies a configurable number of columns, allowing you to create layouts with multiple widgets side by side.

## Widget types

| Type | Description | Example use |
|------|-------------|-------------|
| `fields` | Key-value fields in columns. | Customer data, Address. |
| `collection` | List of items with pagination. | Nationalities, Partners. |
| `table` | Data in table format. | Contact moments. |
| `interactive-table` | Table with sorting and filtering. | Running cases. |
| `map` | Geographic map display. | Location. |
| `divider` | Visual separation between widgets. | Grouping related widgets. |

<figure><img src="../../.gitbook/assets/iko/widget-fields-example.png" alt="Fields widget example"><figcaption><p>A fields widget displaying customer data.</p></figcaption></figure>

<figure><img src="../../.gitbook/assets/iko/widget-interactive-table-example.png" alt="Interactive table widget example"><figcaption><p>An interactive table widget with sorting and a link action.</p></figcaption></figure>

## Configuration

{% tabs %}
{% tab title="Via UI" %}

### Widget configuration wizard

The widget configuration goes through 6 steps:

#### Step 1: Choose widget type

Select from: Fields, Collection, Table, Interactive table, Map, or Divider.

<figure><img src="../../.gitbook/assets/iko/widget-wizard-step1.png" alt="Widget wizard step 1"><figcaption><p>Select the widget type.</p></figcaption></figure>

#### Step 2: Choose widget width

The screen is divided into 4 columns. Select how many columns the widget should span:

| Option | Columns | Description |
|--------|---------|-------------|
| Small | 1 | Quarter width. |
| Medium | 2 | Half width. |
| Large | 3 | Three-quarter width. |
| Extra large | 4 | Full width. |

<figure><img src="../../.gitbook/assets/iko/widget-wizard-step2.png" alt="Widget wizard step 2"><figcaption><p>Select the widget width.</p></figcaption></figure>

#### Step 3: Choose widget density

| Option | Description |
|--------|-------------|
| Default | Normal spacing between elements. |
| Compact | Reduced spacing for more content in less space. |

<figure><img src="../../.gitbook/assets/iko/widget-wizard-step3.png" alt="Widget wizard step 3"><figcaption><p>Select the widget density.</p></figcaption></figure>

#### Step 4: Choose widget style

| Option | Description |
|--------|-------------|
| Default | Normal display for regular content. |
| High contrast | Inverted colors for emphasis. In light mode the widget appears dark, in dark mode the widget appears light. |

<figure><img src="../../.gitbook/assets/iko/widget-wizard-step4.png" alt="Widget wizard step 4"><figcaption><p>Select the widget style.</p></figcaption></figure>

<figure><img src="../../.gitbook/assets/iko/widget-high-contrast.png" alt="High contrast comparison"><figcaption><p>Comparison of default and high contrast styles.</p></figcaption></figure>

#### Step 5: Choose widget content

Configure the widget title, icon, data path, and fields.

<figure><img src="../../.gitbook/assets/iko/widget-wizard-step5.png" alt="Widget wizard step 5"><figcaption><p>Configure the widget content.</p></figcaption></figure>

| Field | Description |
|-------|-------------|
| Widget title | Title displayed above the widget. |
| Icon | Optional icon (select from list). |
| Path to table data | Data path for table/collection widgets (e.g. `iko:/running_cases`). |
| Rows per page | Number of rows to display per page. |
| Columns | Field columns to display in the widget. |

#### Step 6: Set display conditions

Configure conditions that determine when the widget is shown. If multiple conditions are configured, all must be met for the widget to display.

<figure><img src="../../.gitbook/assets/iko/widget-wizard-step6.png" alt="Widget wizard step 6"><figcaption><p>Configure display conditions.</p></figcaption></figure>

| Field | Description |
|-------|-------------|
| Path | Data path for the condition. |
| Operator | Comparison operator (e.g. `==`, `!=`, `>`, `<`). |
| Value | Value to compare against. |

### JSON editor

For advanced configuration, switch to the JSON editor. The JSON editor allows direct editing of the widget configuration. See the "Via IDE" tab for the JSON schema reference.

<figure><img src="../../.gitbook/assets/iko/visual-vs-json-editor.png" alt="Visual and JSON editor toggle"><figcaption><p>Switch between visual editor and JSON editor.</p></figcaption></figure>

{% endtab %}

{% tab title="Via IDE" %}

Widgets can be configured through autodeployment.

### File structure

```
config/global/iko/{view-name}/
└── {name}.iko-widget.json
```

### Base widget schema

All widgets share these base properties:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Widget type (discriminator). |
| `key` | string | Yes | Unique identifier. |
| `title` | string | Yes | Widget title. |
| `icon` | string | No | Icon name. |
| `width` | integer | Yes | Width in columns (1-4). |
| `highContrast` | boolean | Yes | Enable high contrast style. |
| `isCompact` | boolean | No | Enable compact density. |
| `actions` | array | No | Widget actions (see Actions section). |
| `displayConditions` | array | No | Conditions for showing the widget. |
| `properties` | object | Yes | Type-specific properties. |

### Fields widget example

{% code title="general.iko-widget.json" %}
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
            },
            {
              "key": "birthdate",
              "title": "Date of birth",
              "value": "iko:/person/birth/date/date",
              "displayProperties": {
                "type": "date",
                "format": "DD-MM-YYYY",
                "hideWhenEmpty": false
              }
            }
          ],
          [
            {
              "key": "bsn",
              "title": "BSN",
              "value": "iko:/person/burgerservicenummer"
            }
          ]
        ]
      }
    }
  ]
}
```
{% endcode %}

### Collection widget example

{% code title="nationalities.iko-widget.json" %}
```json
{
  "type": "collection",
  "key": "nationalities",
  "title": "Nationalities",
  "width": 1,
  "highContrast": false,
  "properties": {
    "collection": "iko:/person/nationalities",
    "defaultPageSize": 4,
    "title": {
      "value": "/nationality/description"
    },
    "fields": [
      {
        "key": "nationality",
        "title": "Nationality",
        "value": "/nationality/description",
        "width": "full"
      },
      {
        "key": "startDate",
        "title": "Start date",
        "value": "/dateStartValidity/longFormat",
        "width": "half"
      }
    ]
  }
}
```
{% endcode %}

### Interactive table widget example

{% code title="cases.iko-widget.json" %}
```json
{
  "type": "interactive-table",
  "key": "cases",
  "title": "Running Cases",
  "width": 4,
  "highContrast": false,
  "actions": [
    {
      "type": "link",
      "url": "https://example.com/cases",
      "label": "View all cases"
    }
  ],
  "properties": {
    "collection": "iko:/cases",
    "defaultPageSize": 10,
    "canStartCase": true,
    "columns": [
      {
        "key": "identification",
        "title": "Case number",
        "value": "identification",
        "sortable": true
      },
      {
        "key": "startdate",
        "title": "Start date",
        "value": "startdate",
        "sortable": true,
        "defaultSort": "DESC",
        "displayProperties": {
          "type": "date",
          "format": "DD-MM-YYYY"
        }
      }
    ]
  }
}
```
{% endcode %}

{% endtab %}
{% endtabs %}

## Widget order

The order of widgets within a tab can be adjusted via drag & drop. Widgets are displayed from left to right, top to bottom, filling the available columns.

<figure><img src="../../.gitbook/assets/iko/widgets-drag-drop.png" alt="Widget drag and drop"><figcaption><p>Reorder widgets via drag & drop.</p></figcaption></figure>

## Dividers

A divider is a special widget type that creates visual separation between groups of widgets. Add a divider from the widget list to create a horizontal line spanning the full width.

<figure><img src="../../.gitbook/assets/iko/widget-divider-example.png" alt="Divider between widgets"><figcaption><p>A divider separating two groups of widgets.</p></figcaption></figure>

## Widget actions

Actions add buttons to a widget that allow users to perform operations. Actions appear in the top-right corner of the widget.

<figure><img src="../../.gitbook/assets/iko/widget-action-example.png" alt="Widget with action button"><figcaption><p>A widget with an action button.</p></figcaption></figure>

### Action types

| Type | Description |
|------|-------------|
| Link | Navigate to a URL. |
| Create new case | Show a dropdown with available case definitions. User selects one and the start form opens. |
| Start process | Start a specific process configured by the administrator. |

### Configuring a link action

Link actions navigate the user to a specified URL. The URL can contain placeholders to include dynamic data.

<figure><img src="../../.gitbook/assets/iko/widget-action-link-config.png" alt="Link action configuration"><figcaption><p>Configure a link action with URL and button label.</p></figcaption></figure>

| Field | Description |
|-------|-------------|
| Link-URL (with variables) | The target URL. Use placeholders like `${iko:/person/bsn}` for dynamic values. |
| Button label | The text displayed on the button. |

**Example configuration:**

| Field | Value |
|-------|-------|
| Link-URL (with variables) | `https://example.com/details/${iko:/person/bsn}` |
| Button label | View details |

### Configuring create new case

The "Create new case" action displays a button with a dropdown menu. The dropdown shows all available GZAC case definitions. When the user selects a case definition, the start form for that case opens.

Enable this action by setting `canStartCase` to `true` in the widget properties.

### Configuring start process

The "Start process" action starts a specific process. Unlike "Create new case", the process is configured by the administrator in the widget settings, not selected by the user.

| Field | Description |
|-------|-------------|
| Process definition | The process to start. |
| Button label | The text displayed on the button. |

## Display properties (optional)

Display properties control how field values are rendered. If not specified, values are displayed as plain text.

| Type | Parameters | Description |
|------|------------|-------------|
| `text` | `hideWhenEmpty` | Standard text display. |
| `number` | `hideWhenEmpty` | Numeric display. |
| `date` | `format`, `hideWhenEmpty` | Date display. |
| `datetime` | `format`, `hideWhenEmpty` | Date and time display. |
| `boolean` | `hideWhenEmpty` | Yes/No display. |
| `currency` | `hideWhenEmpty` | Currency display. |
| `percent` | `hideWhenEmpty` | Percentage display. |
| `link` | `hideWhenEmpty` | Hyperlink display. |

### Date formats

| Pattern | Description | Example |
|---------|-------------|---------|
| `DD-MM-YYYY` | Day-Month-Year. | 31-12-2024 |
| `YYYY-MM-DD` | Year-Month-Day. | 2024-12-31 |
| `DD/MM/YYYY` | Day/Month/Year. | 31/12/2024 |

## Value resolvers

Values in widgets are retrieved using the `iko:` prefix, which indicates the value should be retrieved from the IKO data context.

| Pattern | Description |
|---------|-------------|
| `iko:/path/to/field` | Absolute path from the root context. |
| `/path/to/field` | Relative path within a collection item. |

**Examples:**

```
iko:/person/name/fullName          → Retrieves full name from person data.
iko:/person/burgerservicenummer    → Retrieves BSN from person data.
/nationality/description           → Retrieves description within a nationality item.
```

## Display conditions

Display conditions determine when a widget is shown based on data values. If multiple conditions are configured, all must be met.

| Field | Description |
|-------|-------------|
| Path | Data path for the condition. |
| Operator | Comparison operator (`==`, `!=`, `>`, `<`, `>=`, `<=`). |
| Value | Value to compare against. |

**Example:** Only show a widget when the person has Dutch nationality:

| Field | Value |
|-------|-------|
| Path | `iko:/person/nationality/code` |
| Operator | `==` |
| Value | `NL` |

## Related

* [Tabs](tabs.md)
* [Views](views.md)
