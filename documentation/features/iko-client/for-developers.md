---
icon: laptop-code
---

# For developers

{% hint style="info" %}
The for developers section provides technical information about autodeployment configuration and JSON schemas for IKO.
{% endhint %}

## Autodeployment

IKO configurations can be managed as JSON files and automatically loaded into the database at application startup.

### File location

All configuration files must be placed in the following directory structure:

```
config/global/iko/
├── {name}.iko-repository-config.json      # Repository configurations
└── {view-name}/                            # Subdirectory per view
    ├── {name}.iko-view.json
    ├── {name}.iko-search-action.json
    ├── {name}.iko-search-field.json
    ├── {name}.iko-list-column.json
    ├── {name}.iko-tab.json
    └── {name}.iko-widget.json
```

### File extensions

| Extension | Description |
|----------|--------------|
| `.iko-repository-config.json` | Backend data source configuration |
| `.iko-view.json` | View definition |
| `.iko-search-action.json` | Search actions |
| `.iko-search-field.json` | Search fields per search action |
| `.iko-list-column.json` | Columns in search results |
| `.iko-tab.json` | Tabs within a view |
| `.iko-widget.json` | Widgets within a tab |

### Deployment order

Files are processed in a specific order due to dependencies:

```
1. iko-repository-config  ─────────────────────────────────┐
                                                           │
2. iko-view ──────────────── depends on: repository-config
       │
       ├── 3. iko-search-action ── depends on: view
       │           │
       │           └── 4. iko-search-field ── depends on: search-action
       │
       ├── 5. iko-tab ──────────── depends on: view
       │           │
       │           └── 7. iko-widget ──────── depends on: tab
       │
       └── 6. iko-list-column ──── depends on: view
```

---

## Configuration schemas

<details>
<summary>Repository Config</summary>

Defines the backend data source connection.

**File extension:** `*.iko-repository-config.json`

#### Schema

| Field | Type | Required | Description |
|-------|------|----------|--------------|
| `key` | string | ✓ | Unique identifier |
| `title` | string | ✓ | Display name |
| `type` | string | ✓ | Repository type (e.g. `iko`) |
| `properties` | object | | Type-specific configuration |

#### Example

```json
{
  "key": "iko-api",
  "title": "IKO API Server",
  "type": "iko",
  "properties": {
    "ikoServerUrl": "${VALTIMO_IKO_API_URL}"
  }
}
```

</details>

<details>
<summary>View</summary>

Defines an IKO view linked to a repository config.

**File extension:** `*.iko-view.json`

#### Schema

| Field | Type | Required | Description |
|-------|------|----------|--------------|
| `key` | string | ✓ | Unique identifier |
| `ikoRepositoryConfigKey` | string | ✓ | Reference to repository config |
| `title` | string | ✓ | Display name |
| `properties` | object | | View-specific properties |

#### Properties

| Property | Type | Description |
|----------|------|--------------|
| `connectorTag` | string | Connector tag (e.g. `brp`) |
| `connectorInstanceTag` | string | Connector instance tag |
| `endpointOperation` | string | API operation name |
| `endpointQueryParameters` | object | Query parameters for the API |

#### Example

```json
{
  "key": "customer",
  "ikoRepositoryConfigKey": "iko-api",
  "title": "Customer (BRP)",
  "properties": {
    "connectorTag": "brp",
    "connectorInstanceTag": "brp1",
    "endpointOperation": "Persons",
    "endpointQueryParameters": {
      "fields": "burgerservicenummer,name,birth,residence"
    }
  }
}
```

</details>

<details>
<summary>Search Actions</summary>

Defines available search actions within a view.

**File extension:** `*.iko-search-action.json`

#### Schema

| Field | Type | Required | Description |
|-------|------|----------|--------------|
| `ikoViewKey` | string | ✓ | Reference to parent view |
| `ikoSearchActions` | array | ✓ | List of search actions |

#### Search Action Object

| Field | Type | Required | Description |
|-------|------|----------|--------------|
| `key` | string | ✓ | Unique identifier |
| `title` | string | ✓ | Display name |
| `properties` | object | | Action-specific properties |

#### Example

```json
{
  "ikoViewKey": "customer",
  "ikoSearchActions": [
    {
      "key": "bsn",
      "title": "Search by BSN",
      "properties": {
        "endpointQueryParameters": {
          "type": "RaadpleegMetBurgerservicenummer"
        }
      }
    }
  ]
}
```

</details>

<details>
<summary>Search Fields</summary>

Defines input fields for a specific search action.

**File extension:** `*.iko-search-field.json`

#### Schema

| Field | Type | Required | Description |
|-------|------|----------|--------------|
| `ikoViewKey` | string | ✓ | Reference to parent view |
| `ikoSearchActionKey` | string | ✓ | Reference to search action |
| `ikoSearchFields` | array | ✓ | List of search fields |

#### Search Field Object

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|--------------|
| `key` | string | ✓ | | Unique identifier |
| `title` | string | | | Display label |
| `path` | string | ✓ | | Path to data field in query |
| `dataType` | enum | ✓ | | Data type (`text`, `number`, `date`, `datetime`, `time`, `boolean`, `bsn`) |
| `fieldType` | enum | ✓ | | Input type (`single`, `range`, `single-select-dropdown`, `multi-select-dropdown`) |
| `matchType` | enum | | | Match strategy (`exact`, `like`) |
| `dropdownDataProvider` | string | | | Data provider for dropdown options |
| `required` | boolean | | `false` | Is the field required? |

#### Example

```json
{
  "ikoViewKey": "customer",
  "ikoSearchActionKey": "name-birthdate",
  "ikoSearchFields": [
    {
      "key": "surname",
      "title": "Surname",
      "path": "familyName",
      "dataType": "text",
      "fieldType": "single",
      "matchType": "exact",
      "required": true
    }
  ]
}
```

</details>

<details>
<summary>List Columns</summary>

Defines columns in the search results list.

**File extension:** `*.iko-list-column.json`

#### Schema

| Field | Type | Required | Description |
|-------|------|----------|--------------|
| `ikoViewKey` | string | ✓ | Reference to parent view |
| `ikoListColumns` | array | ✓ | List of columns |

#### List Column Object

| Field | Type | Required | Description |
|-------|------|----------|--------------|
| `id` | UUID | | Optional fixed ID |
| `key` | string | ✓ | Unique identifier |
| `title` | string | | Column header |
| `path` | string | ✓ | JSON path to data |
| `displayType` | object | ✓ | Display configuration |
| `sortable` | boolean | ✓ | Is the column sortable? |
| `defaultSort` | enum | | Default sort direction (`ASC` or `DESC`) |

#### Example

```json
{
  "ikoViewKey": "customer",
  "ikoListColumns": [
    {
      "key": "name",
      "title": "Name",
      "path": "/name/fullName",
      "displayType": {
        "type": "text",
        "displayTypeParameters": {}
      },
      "sortable": true,
      "defaultSort": "ASC"
    }
  ]
}
```

</details>

<details>
<summary>Tabs</summary>

Defines tabs shown when a record is selected.

**File extension:** `*.iko-tab.json`

#### Schema

| Field | Type | Required | Description |
|-------|------|----------|--------------|
| `ikoViewKey` | string | ✓ | Reference to parent view |
| `ikoTabs` | array | ✓ | List of tabs |

#### Tab Object

| Field | Type | Required | Description |
|-------|------|----------|--------------|
| `key` | string | ✓ | Unique identifier |
| `title` | string | | Display name |
| `type` | string | ✓ | Tab type (e.g. `widgets`) |
| `properties` | object | | Tab-specific properties |

#### Example

```json
{
  "ikoViewKey": "customer",
  "ikoTabs": [
    {
      "key": "general",
      "title": "General",
      "type": "widgets",
      "properties": {
        "aggregatedDataProfileName": "Persons"
      }
    }
  ]
}
```

</details>

<details>
<summary>Widgets</summary>

Defines widgets shown within a tab.

**File extension:** `*.iko-widget.json`

#### Schema

| Field | Type | Required | Description |
|-------|------|----------|--------------|
| `ikoViewKey` | string | ✓ | Reference to parent view |
| `ikoTabKey` | string | ✓ | Reference to parent tab |
| `ikoWidgets` | array | ✓ | List of widgets |

#### Base Widget Object

| Field | Type | Required | Description |
|-------|------|----------|--------------|
| `type` | string | ✓ | Widget type (discriminator) |
| `key` | string | ✓ | Unique identifier |
| `title` | string | ✓ | Widget title |
| `icon` | string | | Icon name |
| `width` | integer | ✓ | Width in columns (1-4) |
| `highContrast` | boolean | ✓ | High contrast display |
| `isCompact` | boolean | | Compact display |
| `actions` | array | | Widget actions |
| `displayConditions` | array | | Conditions for showing |
| `properties` | object | ✓ | Type-specific properties |

#### Available Widget Types

| Type | Description |
|------|--------------|
| `fields` | Key-value fields in columns |
| `collection` | List of items with pagination |
| `table` | Data in table format |
| `interactive-table` | Table with sorting and filtering |
| `map` | Geographic map display |
| `divider` | Visual separation |
| `custom` | Custom widget |

</details>

---

## Widget type examples

<details>
<summary>Fields Widget</summary>

Displays key-value fields organized in columns.

```json
{
  "type": "fields",
  "key": "personal-data",
  "title": "Personal Data",
  "width": 2,
  "highContrast": true,
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
```

</details>

<details>
<summary>Collection Widget</summary>

Displays a list of related items with pagination.

```json
{
  "type": "collection",
  "key": "nationalities",
  "title": "Nationalities",
  "width": 1,
  "highContrast": false,
  "actions": [],
  "displayConditions": [],
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

</details>

<details>
<summary>Interactive Table Widget</summary>

Displays data in a table with sorting and filtering.

```json
{
  "type": "interactive-table",
  "key": "cases",
  "title": "Running Cases",
  "width": 4,
  "highContrast": false,
  "actions": [],
  "displayConditions": [],
  "properties": {
    "collection": "iko:/cases",
    "defaultPageSize": 10,
    "columns": [
      {
        "key": "identification",
        "title": "Case number",
        "value": "identification",
        "sortable": true,
        "displayProperties": {
          "type": "text"
        }
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
    ],
    "filters": [
      {
        "key": "status",
        "title": "Status",
        "dataType": "text",
        "fieldType": "single-select-dropdown",
        "matchType": "exact"
      }
    ],
    "firstColumnAsTitle": true,
    "canStartCase": false
  }
}
```

</details>

<details>
<summary>Map Widget</summary>

Displays geographic data on a map.

```json
{
  "type": "map",
  "key": "location",
  "title": "Location",
  "width": 2,
  "highContrast": false,
  "actions": [],
  "displayConditions": [],
  "properties": {
    "geoJsonSources": [
      {
        "key": "iko:/residence/geometry"
      }
    ]
  }
}
```

</details>

<details>
<summary>Divider Widget</summary>

Visual separation between widgets.

```json
{
  "type": "divider",
  "key": "separator-1",
  "title": "",
  "width": 4,
  "highContrast": false,
  "actions": [],
  "displayConditions": []
}
```

</details>

---

## Complete configuration example

### Directory structure

```
config/global/iko/
├── iko-api.iko-repository-config.json
└── customer/
    ├── customer.iko-view.json
    ├── customer.iko-search-action.json
    ├── bsn.iko-search-field.json
    ├── customer.iko-list-column.json
    ├── customer.iko-tab.json
    └── general.iko-widget.json
```

---

## Best practices

1. **Use descriptive keys**: Keys are used as identifiers and must be unique within their scope.

2. **Organize per view**: Place all configurations for a view in its own subdirectory.

3. **Validate JSON**: Verify all JSON files are valid before deployment.

4. **Test incrementally**: Deploy and test configurations step by step to identify issues quickly.

5. **Use environment variables**: Use `${VAR_NAME}` syntax for environment-dependent values like URLs.
