# Views

Configure IKO Servers and Views to connect to backend data sources and define how data is presented.

## Overview

A View represents a type of integrated view, for example "Customer (BRP)", "Object", or "Building". Before creating Views, an IKO Server must be configured. Multiple Views can be configured per IKO Server.

## Configuration

{% tabs %}
{% tab title="Via UI" %}

### Adding an IKO Server

1. Navigate to **Admin → IKO**.
2. Click **Add IKO Server**.
3. Configure the server properties.

<figure><img src="../../.gitbook/assets/iko/admin-iko-menu.png" alt="Admin menu with IKO option"><figcaption><p>Navigate to Admin → IKO to manage IKO Servers and Views.</p></figcaption></figure>

| Field | Description |
|-------|-------------|
| Title | Display name for the IKO Server. |
| Key | Technical key (auto-generated, adjustable). |
| IKO Server URL | URL to the IKO Server. |

<figure><img src="../../.gitbook/assets/iko/add-iko-server.png" alt="Add IKO Server form"><figcaption><p>Configure the IKO Server connection.</p></figcaption></figure>

### Creating a View

1. Select an IKO Server from the list.
2. Click **Add View**.
3. Configure the View properties.

<figure><img src="../../.gitbook/assets/iko/add-view-form.png" alt="Add View form"><figcaption><p>Configure View properties including connector and endpoint settings.</p></figcaption></figure>

{% endtab %}

{% tab title="Via IDE" %}

Views can be configured through autodeployment by placing JSON configuration files in the `config/global/iko/` directory.

### File structure

```
config/global/iko/
├── {name}.iko-repository-config.json
└── {view-name}/
    ├── {name}.iko-view.json
    └── ...
```

### Repository config example

{% code title="iko-api.iko-repository-config.json" %}
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
{% endcode %}

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Unique identifier for the repository config. |
| `title` | string | Yes | Display name. |
| `type` | string | Yes | Repository type (e.g. `iko`). |
| `properties` | object | No | Type-specific configuration properties. |

### View example

{% code title="customer.iko-view.json" %}
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
{% endcode %}

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Unique identifier for the view. |
| `ikoRepositoryConfigKey` | string | Yes | Reference to repository config. |
| `title` | string | Yes | Display name. |
| `properties.connectorTag` | string | No | Connector tag (e.g. `brp`). |
| `properties.connectorInstanceTag` | string | No | Connector instance tag. |
| `properties.endpointOperation` | string | No | API operation name. |
| `properties.endpointQueryParameters` | object | No | Query parameters for the API. |

{% endtab %}
{% endtabs %}

## View properties

| Field | Description |
|-------|-------------|
| Title | Display name (e.g. "Customer BRP"). |
| Key | Technical key (e.g. `customer-brp`). |
| Connector Reference | Reference to the connector (e.g. `connector-in-iko`). |
| Connector Instance Reference | Instance reference (e.g. `connector-instance`). |
| Endpoint Reference | API endpoint on the IKO Server (e.g. `list_persons`). |
| Endpoint Query Parameters | Key-Value pairs for query parameters. |

## View components

Each View has three configurable components:

| Component | Description |
|-----------|-------------|
| **Search Actions** | Define how users can search within the View. |
| **List** | Configure columns for the search results table. |
| **Tabs** | Organize detail screen information into tabs with widgets. |

## Related

* [Search actions](search-actions.md)
* [List](list.md)
* [Tabs](tabs.md)
