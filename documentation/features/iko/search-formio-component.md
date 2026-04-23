# Search FormIO component

Embed IKO search and selection inside a FormIO task form.

## Overview

The IKO Search FormIO component adds a custom FormIO field that lets case workers search for a customer or object and select a result, all within a user task form. When a result is selected, the ID and any configured property values are written to the case document as a single object.

This allows a BPMN process to collect an IKO reference during a user task and then use the stored data in subsequent steps, case widgets, or process logic.

## How it works

The component goes through three steps:

1. **Search** — The case worker fills in the search criteria defined in the IKO view and submits.
2. **Select** — The search results appear in a table. The case worker clicks a row to select it.
3. **Confirm** — The selected result is shown. The case worker can go back to search again, open the IKO detail page in a new tab, or submit the form.

When the form is submitted, the component value is written to the case document at the configured path. The value is an object containing the `id` of the selected result and any mapped property values.

**Example document content after submission:**

```json
{
  "ikoSearchResult": {
    "id": "999993653",
    "naam": "Jan Jansen",
    "adres": "Hoofdstraat 1",
    "geboortedatum": "1990-01-15"
  }
}
```

## Registration

The component must be registered in the application module before it can be used in forms.

```typescript
import {IkoModule, registerIkoSearchFormioComponent} from '@valtimo/iko';

@NgModule({
  imports: [IkoModule],
})
export class AppModule {
  constructor(private injector: Injector) {
    registerIkoSearchFormioComponent(injector);
  }
}
```

After registration, the **IKO Search** component appears in the FormIO form builder under the **Advanced** section.

## Configuration

The component can be configured through the FormIO form builder or directly in the form JSON.

### Form builder fields

| Field | Required | Description |
|-------|----------|-------------|
| Label | Yes | Display label for the component. |
| Property Name | Yes | Document path where the result object is stored. Uses dot notation, no prefixes (e.g. `ikoSearchResult`). |
| IKO Beeld Key | Yes | The IKO view key used to load search actions (e.g. `demo`). |
| Result List Label | No | Label shown above the results table. |
| Selected Item Label | No | Label shown above the selection box. |
| Open in New Tab Button Text | No | Text for the external link button. Leave empty to hide the button. |
| Open in New Tab URL | No | URL template with `{id}` placeholder (e.g. `/iko/demo/bsn/details/{id}`). Leave empty to hide the button. |

### Property mappings

Property mappings store IKO search result column values alongside the ID in the document.

Each mapping has two fields:

| Field | Description |
|-------|-------------|
| Table Column Key | The column key from the IKO view, matching the key in the list configuration (e.g. `naam`, `adres`). |
| Document Property Name | The property name under which the value is stored, relative to the component key (e.g. `geboortedatum` stores at `/ikoSearchResult/geboortedatum`). |

{% hint style="warning" %}
Do not include `doc:` or `iko:` prefixes in any of the configuration fields. The component works with plain property names and dot notation paths.
{% endhint %}

### Form JSON example

```json
{
  "type": "iko-search",
  "key": "ikoSearchResult",
  "label": "Zoek in IKO",
  "hideLabel": true,
  "customOptions": {
    "ikoViewKey": "demo",
    "resultListLabel": "Selecteer een persoon",
    "selectedLabel": "Geselecteerd persoon",
    "openInNewTabLabel": "Open persoon in nieuw tabblad",
    "openInNewTabUrl": "/iko/demo/bsn/details/{id}",
    "propertyMappings": [
      {
        "ikoProperty": "naam",
        "propertyName": "naam"
      },
      {
        "ikoProperty": "adres",
        "propertyName": "adres"
      },
      {
        "ikoProperty": "geboortedatum",
        "propertyName": "geboortedatum"
      }
    ]
  },
  "input": true,
  "tableView": true
}
```

### Document definition

The document definition must include an object property at the component key path with the expected sub-properties.

```json
{
  "ikoSearchResult": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string"
      },
      "naam": {
        "type": "string"
      },
      "adres": {
        "type": "string"
      },
      "geboortedatum": {
        "type": "string"
      }
    }
  }
}
```

## Using stored values in case widgets

After the form is submitted, the stored properties can be displayed in case widgets using `doc:` value resolver paths.

```json
{
  "key": "naam",
  "title": "Naam",
  "value": "doc:ikoSearchResult.naam"
}
```

This avoids the need to call the IKO API again at display time. The values are already in the document.

## Related

* [Views](views.md)
* [Search actions](search-actions.md)
* [List](list.md)
* [Widgets](widgets.md)
