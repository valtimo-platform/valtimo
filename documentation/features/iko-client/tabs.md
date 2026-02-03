# Tabs

Organize detail screen information into logical groups using tabs.

## Overview

Tabs organize the information on the IKO detail screen into logical groups. Each tab contains one or more widgets that display the actual data. When a user opens a customer or object detail screen, they can navigate between tabs to view different categories of information.

### Examples of tabs

- General.
- Running Cases.
- Notes.
- Products.
- Contact Moments.
- Documents.
- Work.
- Income.

## Configuration

{% tabs %}
{% tab title="Via UI" %}

### Creating a tab

1. Navigate to **Admin → IKO**.
2. Select an IKO Server and View.
3. Go to the **Tabs** section.
4. Click **Add Tab**.
5. Configure the tab name.
6. Add widgets to the tab.

<figure><img src="../../.gitbook/assets/iko/tabs-config-list.png" alt="List of configured tabs"><figcaption><p>Tabs configured for a View.</p></figcaption></figure>

{% hint style="info" %}
The order of tabs can be adjusted via drag & drop.
{% endhint %}

<figure><img src="../../.gitbook/assets/iko/tabs-user-view.png" alt="Tabs as seen by users"><figcaption><p>Tabs displayed on the detail screen.</p></figcaption></figure>

{% endtab %}

{% tab title="Via IDE" %}

Tabs can be configured through autodeployment.

### File structure

```
config/global/iko/{view-name}/
└── {name}.iko-tab.json
```

### Example

{% code title="customer.iko-tab.json" %}
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
{% endcode %}

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ikoViewKey` | string | Yes | Reference to parent view. |
| `ikoTabs` | array | Yes | List of tabs. |
| `ikoTabs[].key` | string | Yes | Unique identifier. |
| `ikoTabs[].title` | string | No | Display name of the tab. |
| `ikoTabs[].type` | string | Yes | Tab type (typically `widgets`). |
| `ikoTabs[].properties.aggregatedDataProfileName` | string | No | Name of the data profile for aggregation. |

{% endtab %}
{% endtabs %}

## Tab properties

| Field | Description |
|-------|-------------|
| Key | Technical key (unique identifier). |
| Title | Display name of the tab. |
| Type | Tab type (typically `widgets`). |
| Aggregated Data Profile Name | Name of the data profile for aggregation (optional). |

## Tab contents

Each Tab contains one or more Widgets. See [Widgets](widgets.md) for detailed configuration options.

## Related

* [Views](views.md)
* [Widgets](widgets.md)
