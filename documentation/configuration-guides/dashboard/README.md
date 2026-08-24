# Dashboard

Dashboards show aggregated numbers about the cases and tasks in Valtimo, such as how many cases have a certain status or how many tasks are still unassigned. A dashboard contains one or more widgets, and every widget combines a **data source**, which produces the numbers, with a **display type**, which determines how those numbers are shown.

This section covers:

- **[Widget data sources](widget-data-sources.md)** — The data sources included in Valtimo and the properties they accept

---

## Configuring dashboards

{% stepper %}
{% step %}
Go to **Admin** > **Dashboard**
{% endstep %}
{% step %}
Create a dashboard, or open an existing dashboard to configure its widgets
{% endstep %}
{% step %}
Add a widget, choose its data source and display type, and fill in the configuration of both
{% endstep %}
{% endstepper %}

Dashboards can also be provided as configuration files (`*.dashboard.json`) on the classpath of the application, which is the way to configure widget properties that the admin screen does not offer.

---

## Display types

| Display type | Key |
|--------------|-----|
| Bar chart | `bar-chart` |
| Donut | `donut` |
| Gauge | `gauge` |
| Meter | `meter` |
| Number | `number` |

{% hint style="info" %}
Not every display type fits every data source: a display type that shows multiple values (such as the bar chart and the donut) needs a data source that returns multiple counts.
{% endhint %}
