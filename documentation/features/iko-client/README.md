# 👤 IKO Client

The IKO Client module displays integrated customer and object data to case workers and provides a management interface for configuring the presentation.

{% hint style="info" %}
This module requires an active IKO Server installation. The IKO Server is a separate component that retrieves data from backend sources.
{% endhint %}

## What is IKO?

IKO stands for **Integraal Klant- en Objectbeeld** (Integrated Customer and Object View). The purpose of IKO is to provide case workers with a complete picture of the customer or object for which a case is running.

IKO consists of two components:

| Component | Description |
|-----------|-------------|
| **IKO Server** | A separate component (Spring Boot application based on Apache Camel) that retrieves data from multiple backend sources to build a complete view. The IKO Server has its own management interface (outside scope of this documentation). |
| **IKO Client** | Implemented in Valtimo as a module. Displays the aggregated data to the case worker and provides a management interface for configuring the presentation. |

### Data sources

The IKO Server can retrieve data from various backend sources, such as:

- BRP (Basisregistratie Personen)
- KVK (Kamer van Koophandel)
- ZGW APIs (Zaakgericht Werken)
- Domain registrations

### Architecture hierarchy

The IKO management structure follows this hierarchy:

```
IKO Management
└── IKO Server(s)
    └── Views (e.g. Customer BRP, Object, Building)
        ├── Search Actions
        ├── List (search results configuration)
        └── Tabs (detail screen tabs)
            └── Widgets (per tab)
```

## Accessing the IKO view

Case workers can access the IKO view in two ways:

1. **Manual search**: Via the search screen in the Views menu, the case worker can search by BSN, surname + date of birth, or address.

2. **Direct link from case**: On the case detail screen, a widget can be configured with a button/link to the customer detail screen. The identifier (such as BSN or KVK number) is automatically passed from the case document.

{% hint style="info" %}
Configuring a link from a case to an IKO view is done through the case detail tab configuration. See the [Case detail tabs](../cases/case-detail/tabs/README.md) documentation.
{% endhint %}

## In this section

| Page | Description |
|------|-------------|
| [Views](views.md) | Configure IKO Servers and Views |
| [Search actions](search-actions.md) | Configure search actions for finding customers or objects |
| [List](list.md) | Configure search result columns |
| [Tabs](tabs.md) | Organize detail screen information into tabs |
| [Widgets](widgets.md) | Configure data display widgets within tabs |
| [For developers](for-developers.md) | Autodeployment configuration and JSON schemas |

## Quick start

1. Navigate to **Admin → IKO**
2. Add an IKO Server with the server URL
3. Create a View (e.g. "Customer BRP")
4. Configure Search Actions, List columns, and Tabs with Widgets

## Related

* [Case detail tabs](../cases/case-detail/tabs/README.md)
