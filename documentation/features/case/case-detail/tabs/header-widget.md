# Case Header Widget

A **case header widget** displays important case information at the top of a case detail page.  
This section remains visible at all times, regardless of which tab is selected.

## Configuring a Case Header Widget

The configuration for a case header widget is part of the **case definition** setup.

### Steps to configure

1. Go to the **`Admin`** menu.
2. Open the **`Cases`** menu and select the case you want to configure widgets for.
3. Open the **`Case details`** tab.
4. Click the **`Header`** tab.

On this page, you can configure **one header widget**.  
To create it, click the **`Add widget`** button.

You will then go through three setup steps:

1. **Choose widget type**
2. **Choose widget style**
3. **Choose widget content**

> Note: Case header widgets do **not** include width or condition settings.  
> Only the **`Fields`** widget type is supported.

For a detailed explanation of these steps, see the [widget configuration documentation](./widgets.md).

<figure>
  <img src="../../../../.gitbook/assets/add-case-header-widget.png" alt="Add case header widget">
</figure>

---

## Access Control

Access to case header widgets can be managed through **access control settings**.  
For more details, visit the [Access Control documentation](https://docs.valtimo.nl/features/access-control).

### Resources and Actions

| Resource Type | Action | Effect |
|----------------|---------|--------|
| `com.ritense.document.domain.impl.JsonSchemaDocument` | `view` | Allows viewing a case header widget on the case detail page |

---

## Autodeployment via IDE

Case header widgets can also be **automatically deployed** through your IDE.  
For more details, see the [Autodeployment documentation](https://docs.valtimo.nl/features/autodeployment).

To autodeploy a case header widget, add a deployment file to the `header-widget` folder within your case definition.

For example, the following file would automatically deploy a case header widget to version **1.01** of the `bezwaar` case definition:

`config/case/bezwaar/1-0-1/case/header-widget/bezwaar.case-header-widget.json`

```json
{
    "type": "fields",
    "highContrast": false,
    "properties": {
        "columns": [
            [
                {
                    "key": "voornaam",
                    "title": "Voornaam",
                    "value": "doc:voornaam",
                    "displayProperties": { "type": "text" }
                },
                {
                    "key": "achternaam",
                    "title": "Achternaam",
                    "value": "doc:achternaam",
                    "displayProperties": { "type": "text" }
                }
            ],
            [
                {
                    "key": "aangemaakt-op",
                    "title": "Aangemaakt op",
                    "value": "case:createdOn",
                    "displayProperties": { "type": "date" }
                }
            ],
            [
                {
                    "key": "aangemaakt-door",
                    "title": "Aangemaakt door",
                    "value": "case:createdBy",
                    "displayProperties": { "type": "text" }
                }
            ],
            [
                {
                    "key": "e-mail",
                    "title": "E-mail",
                    "value": "doc:e-mailadres",
                    "displayProperties": { "type": "text" }
                }
            ]
        ]
    }
}

```
