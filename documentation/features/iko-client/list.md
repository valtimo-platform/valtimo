# List

Configure the columns displayed in search results.

## Overview

The List configuration determines which columns are shown in the search results table after a user performs a search. Each column displays data from a specific path in the search results.

## Configuration

{% tabs %}
{% tab title="Via UI" %}

### Configuring list columns

1. Navigate to **Admin → IKO**
2. Select an IKO Server and View
3. Go to the **List** section
4. Add or edit columns

| Field | Description |
|-------|-------------|
| Title | Column header text |
| Key | Technical key |
| Path | Data path (e.g. "/name/fullName") |
| Display Type | Display type (Text, Date, etc.) |
| Parameters | Additional display parameters |
| Sortable | Enable sorting on this column |
| Default Sort | Use as default sort column |

{% endtab %}

{% tab title="Via IDE" %}

List columns can be configured through autodeployment.

**List columns** (`*.iko-list-column.json`):

```json
{
  "ikoViewKey": "customer",
  "ikoListColumns": [
    {
      "key": "bsn",
      "title": "BSN",
      "path": "/burgerservicenummer",
      "displayType": {
        "type": "text",
        "displayTypeParameters": {}
      },
      "sortable": false
    },
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
    },
    {
      "key": "birthdate",
      "title": "Date of birth",
      "path": "/birth/date/date",
      "displayType": {
        "type": "date",
        "displayTypeParameters": {
          "format": "DD-MM-YYYY"
        }
      },
      "sortable": true
    }
  ]
}
```

See [For developers](for-developers.md) for complete schema documentation.

{% endtab %}
{% endtabs %}

## Display types

| Type | Description |
|------|-------------|
| `text` | Standard text display |
| `number` | Numeric display |
| `date` | Date display (configurable format) |
| `datetime` | Date and time display |
| `boolean` | Yes/No display |
| `currency` | Currency display |

## Related

* [Views](views.md)
* [Search actions](search-actions.md)
* [For developers](for-developers.md)
