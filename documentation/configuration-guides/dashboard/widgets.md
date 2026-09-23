# Widgets

A widget shows one number, or a set of numbers, on a dashboard. Every widget combines a data source, which determines what is counted, with a display type, which determines how the result is shown.

---

## Adding a widget

{% stepper %}
{% step %}
Go to **Admin** > **Dashboard** and select a dashboard
{% endstep %}
{% step %}
Click **Add new widget**
{% endstep %}
{% step %}
Fill in the widget properties, select a data source and a display type, and configure both
{% endstep %}
{% step %}
Click **Save**
{% endstep %}
{% endstepper %}

| Property | Description |
|----------|-------------|
| Widget title | The title shown above the widget |
| Widget key | A unique key for the widget |
| Data source | Determines what the widget counts |
| Display type | Determines how the result is shown |
| URL path | The path to navigate to when a user clicks the widget |

Widgets are shown in the order of the list on the dashboard configuration page. Drag a widget to another position to change the order.

---

## Data sources

| Data source | What it counts |
|-------------|----------------|
| Case count | The number of cases of one case definition |
| Task count | The number of tasks |
| Multiple case counts | Several counts of cases of one case definition, each with its own label |
| Case group by | The number of cases per value of a chosen field |

{% hint style="info" %}
A widget only counts the cases and tasks that the user viewing the dashboard is allowed to see, so the numbers match what that user finds in the case list and the task list.
{% endhint %}

---

## Display types

| Display type | Shows |
|--------------|-------|
| Number | The count as a single number |
| Gauge | The count as a part of the total |
| Meter | The count as a part of the total, on a horizontal bar |
| Donut | Several counts as parts of a circle |
| Bar chart | Several counts as bars |

{% hint style="info" %}
Not every display type fits every data source: a display type that shows multiple values, such as the donut and the bar chart, needs a data source that returns multiple counts.
{% endhint %}

---

## Configuring a task count widget

A task count widget counts the tasks that match the criteria that are set in its configuration. The gauge and the meter compare that count to the total number of tasks the user can see.

### Case type

{% hint style="success" %}
Available since Valtimo `13.43.0`
{% endhint %}

The **Case type** field limits the widget to the tasks that belong to a case of one case definition. Leave it on **All case types** to count every task the user is allowed to see, including tasks that do not belong to a case.

The case type limits both numbers of the widget. A widget that is limited to one case type therefore shows a part of the tasks of that case type, not a part of all tasks the user can see.

{% hint style="warning" %}
Limiting a widget to a case type requires an installation that includes the process-document module, because the tasks of a case are resolved through that module. If the widget shows no data after a case type has been selected, ask the administrator of the installation whether the module is included.
{% endhint %}

### Conditions

Conditions narrow down which tasks are counted. Every condition consists of three fields.

| Field | Description |
|-------|-------------|
| Path | The task field the condition applies to, for example `task:assignee` or `task:name` |
| Operator | The comparison to make: `==`, `!=`, `>`, `>=`, `<` or `<=` |
| Value | The value the task field is compared to |

Click **Add condition** to add a condition. A widget without conditions counts all tasks that match the selected case type.

### Condition groups

{% hint style="success" %}
Available since Valtimo `13.43.0`
{% endhint %}

Conditions are combined in groups. Every group has an **AND**/**OR** selector that determines how the conditions inside it are combined: **AND** counts the tasks that match all conditions of the group, **OR** counts the tasks that match at least one of them.

Click **Add condition group** to add a group inside the current group. Groups can be nested as deeply as needed, which makes combinations possible such as "the task is assigned **and** has one of two names".

A group has one operator, so all sections within it are combined in the same way. The selector on the connector between the first two sections sets the operator for the whole group, and the following connectors repeat it. To combine sections in different ways, put them in a group of their own.

{% hint style="info" %}
A widget can contain conditions that this screen cannot show, such as a condition that compares a task field to a list of values. Those conditions are kept when the widget is saved and can be changed in the JSON editor of the dashboard. The widget configuration shows a notification when a widget contains such conditions.
{% endhint %}

---

## Editing widgets as JSON

The dashboard configuration page has a **JSON editor** button in the toolbar above the widget list. It shows all widgets of the dashboard as JSON and makes configuration possible that the widget screens do not offer, such as the `in` operator.

More information about the properties of each data source can be found in [Widget data sources](../../advanced/dashboard-widget-data-sources.md).
