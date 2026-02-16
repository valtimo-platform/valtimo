# List

Configure the columns displayed in search results.

## Overview

The List configuration determines which columns are shown in the search results table after a user performs a search. Each column displays data from a specific path in the search results.

## Configuration

### Configuring list columns

1. Navigate to **Admin → IKO**.
2. Select an IKO Server and View.
3. Go to the **List** section.
4. Add or edit columns.

<figure><img src="../../.gitbook/assets/iko/list-columns-config.png" alt="List columns configuration"><figcaption><p>Configure which columns appear in the search results.</p></figcaption></figure>

| Field | Description |
|-------|-------------|
| Title | Column header text. |
| Key | Unique identifier for the column. Use `id` to mark this column as the ID field. |
| Path | Location of the data in the search results using JsonPointer notation (e.g. `/name/fullName`). |
| Display Type | Display type (Text, Date, etc.). |
| Parameters | Additional display parameters. |

{% hint style="warning" %}
Please note that sorting is not supported yet in the results list. The Sortable and default sort properties will be ignored.
{% endhint %}

<figure><img src="../../.gitbook/assets/iko/search-results-table.png" alt="Search results table"><figcaption><p>Search results displayed to case workers.</p></figcaption></figure>

## Display types

| Type      | Description                         |
|-----------|-------------------------------------|
| `text`    | Standard text display.              |
| `date`    | Date display (configurable format). |
| `boolean` | Yes/No display.                     |
| `enum`    | Value from a fixed list.            |
| `hidden`  | Hidden field.                       |

## Related

* [Views](views.md)
* [Search actions](search-actions.md)
