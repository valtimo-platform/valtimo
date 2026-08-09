# Header

The Header sub-tab configures the fields shown at the top of a case's detail page — for example,
key applicant or case details that should be visible at a glance, regardless of which tab is
selected.

## Overview

The header supports exactly one **Fields** widget, laid out in up to four columns. Each column can
contain any number of fields, each showing a label and a value resolved from a path on the case
or document.

## Configuring the header

1. Expand **Admin** in the left sidebar
2. Click **Cases** under the Configuration section
3. Click a case definition to open it
4. Click the **Case details** tab, then the **Header** sub-tab

![Header sub-tab, empty state](../../../assets/configuration-guides/cases/case-details/header/01-header-empty-state.png)

### Adding the header widget

1. Click **Add widget**
2. Since Fields is the only available widget type for the header, select it and click **Next**

![Add widget wizard, widget type step](../../../assets/configuration-guides/cases/case-details/header/02-add-widget-type-step.png)

3. Configure the widget content. Fields are organized into columns — use the **+** tab to add
   another column (up to four), and **Add field** to add a field row within a column:

![Add widget wizard, content step with a field configured](../../../assets/configuration-guides/cases/case-details/header/03-add-widget-content-step-filled.png)

| Property | Description |
|----------|--------------|
| Title | Label shown above the field's value |
| Display type | How the value is formatted: Text, Yes/No, Currency, Date, Date and time, Enumeration, Number, Percentage, or Link |
| Value | Path to the case or document property to display, selected from a dropdown of available paths or typed manually |
| Ellipsis character limit | For Text fields, truncates long values with an ellipsis after this many characters |
| Hide when empty | Hides the field entirely if its resolved value is empty |

Some display types reveal additional options, such as a currency code for Currency, a date format
for Date, or repeatable value pairs for Enumeration.

4. Click **Save**

Only one widget can exist in the header. Once configured, **Add widget** is disabled — edit or
delete the existing widget via its row's overflow menu (⋮) instead:

![Header sub-tab with a configured Fields widget](../../../assets/configuration-guides/cases/case-details/header/04-header-widget-configured-list.png)

{% hint style="info" %}
The header widget has no separate widget title, icon, width, or JSON editor options — it always
spans the full header width and is edited only through this form.
{% endhint %}
