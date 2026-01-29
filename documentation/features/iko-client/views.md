# Views

Configure IKO Servers and Views to connect to backend data sources and define how data is presented.

## Overview

A View represents a type of integrated view, for example "Customer (BRP)", "Object", or "Building". Before creating Views, an IKO Server must be configured. Multiple Views can be configured per IKO Server.

## Configuration

{% tabs %}
{% tab title="Via UI" %}

### Adding an IKO Server

1. Navigate to **Admin → IKO**
2. Click **Add IKO Server**
3. Configure the server properties

| Field | Description |
|-------|-------------|
| Title | Display name for the IKO Server |
| Key | Technical key (auto-generated, adjustable) |
| IKO Server URL | URL to the IKO Server |

### Creating a View

1. Select an IKO Server from the list
2. Click **Add View**
3. Configure the View properties

{% endtab %}

{% tab title="Via IDE" %}

Views can be configured through autodeployment by placing JSON configuration files in the `config/global/iko/` directory.

**Repository config** (`*.iko-repository-config.json`):

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

**View** (`*.iko-view.json`):

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

See [For developers](for-developers.md) for complete autodeployment documentation.

{% endtab %}
{% endtabs %}

## View properties

| Field | Description |
|-------|-------------|
| Title | Display name (e.g. "Customer BRP") |
| Key | Technical key (e.g. "customer-brp") |
| Connector Reference | Reference to the connector (e.g. "connector-in-iko") |
| Connector Instance Reference | Instance reference (e.g. "connector-instance") |
| Endpoint Reference | API endpoint on the IKO Server (e.g. "list_persons") |
| Endpoint Query Parameters | Key-Value pairs for query parameters |

## View components

Each View has three configurable components:

| Component | Description |
|-----------|-------------|
| **Search Actions** | Define how users can search within the View |
| **List** | Configure columns for the search results table |
| **Tabs** | Organize detail screen information into tabs with widgets |

## Related

* [Search actions](search-actions.md)
* [List](list.md)
* [Tabs](tabs.md)
* [For developers](for-developers.md)
