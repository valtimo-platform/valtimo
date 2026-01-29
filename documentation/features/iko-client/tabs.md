# Tabs

Organize detail screen information into logical groups using tabs.

## Overview

Tabs organize the information on the IKO detail screen into logical groups. Each tab contains one or more widgets that display the actual data. When a user opens a customer or object detail screen, they can navigate between tabs to view different categories of information.

### Examples of tabs

- General
- Running Cases
- Notes
- Products
- Contact Moments
- Documents
- Work
- Income

## Configuration

{% tabs %}
{% tab title="Via UI" %}

### Creating a tab

1. Navigate to **Admin → IKO**
2. Select an IKO Server and View
3. Go to the **Tabs** section
4. Click **Add Tab**
5. Configure the tab name
6. Add widgets to the tab

{% hint style="info" %}
The order of tabs can be adjusted via drag & drop.
{% endhint %}

{% endtab %}

{% tab title="Via IDE" %}

Tabs can be configured through autodeployment.

**Tabs** (`*.iko-tab.json`):

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
    },
    {
      "key": "cases",
      "title": "Cases",
      "type": "widgets"
    },
    {
      "key": "documents",
      "title": "Documents",
      "type": "widgets"
    }
  ]
}
```

See [For developers](for-developers.md) for complete schema documentation.

{% endtab %}
{% endtabs %}

## Tab properties

| Field | Description |
|-------|-------------|
| Key | Technical key (unique identifier) |
| Title | Display name of the tab |
| Type | Tab type (typically `widgets`) |
| Aggregated Data Profile Name | Name of the data profile for aggregation (optional) |

## Tab contents

Each Tab contains one or more Widgets. Widgets are the building blocks that display the actual data. See [Widgets](widgets.md) for detailed configuration options.

## Related

* [Views](views.md)
* [Widgets](widgets.md)
* [For developers](for-developers.md)
