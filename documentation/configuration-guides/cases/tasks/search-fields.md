# Search fields

Search fields allow end users to filter the task list by specific data fields. Each search field
can be configured with a data type, match behavior, and field type to control how users interact
with the filter.

---

## Configuring search fields

{% stepper %}
{% step %}
Expand **Admin** in the left sidebar
{% endstep %}
{% step %}
Click **Cases** under the Configuration section
{% endstep %}
{% step %}
Click a case definition to open it
{% endstep %}
{% step %}
Click the **Tasks** tab, then the **Search fields** sub-tab

<figure><img src="../../../assets/configuration-guides/cases/tasks/07-search-fields-list-with-item.png" alt=""><figcaption>Search fields configuration</figcaption></figure>
{% endstep %}
{% endstepper %}

The list shows all configured search fields with their key, path, data type, and field type.
Drag the handle on the left of each row to reorder fields.

### Creating a search field

{% stepper %}
{% step %}
Click the **Create search field** button
{% endstep %}
{% step %}
Fill in the search field properties and select a path from the dropdown

<figure><img src="../../../assets/configuration-guides/cases/tasks/06-add-search-field-modal-filled.png" alt=""><figcaption>Filled search field form</figcaption></figure>
{% endstep %}
{% step %}
Select a data type and field type, then configure additional options based on the data type
{% endstep %}
{% step %}
Click **Create** to add the search field
{% endstep %}
{% endstepper %}

#### Search field properties

| Property | Description |
|----------|-------------|
| Title | Display name for the search field |
| Key | Unique identifier for the search field |
| Path | Path to the searchable data value |
| Data type | The type of data being searched |
| Match | How search values are matched (text fields only) |
| Field type | How the search input is presented to users |
| Dropdown data provider | Source of dropdown options (dropdown field types only) |

#### Data types

| Type | Description |
|------|-------------|
| Text | Text/string values |
| Number | Numeric values |
| Date | Date values (without time) |
| Date and time | Date values with time component |
| Time | Time values only |
| Yes / no | Boolean values |

#### Field types

| Type | Description |
|------|-------------|
| Single | Single value text input |
| Range | Two inputs for from/to values |
| Single select dropdown | Dropdown with single selection |
| Multi select dropdown | Dropdown allowing multiple selections |

#### Match types (text fields only)

| Type | Description |
|------|-------------|
| Exact | Value must match exactly |
| Contains | Value must contain the search term |

#### Dropdown data providers

When using dropdown field types, you can configure where the dropdown options come from:

| Provider | Description |
|----------|-------------|
| Database | Fixed values stored in the database |
| JSON file | Values loaded from a configuration file on the server |

### Editing a search field

Click a search field row to open the edit modal. Modify the properties and click **Save** to
apply changes.

### Deleting a search field

Click the overflow menu (three dots) on the right side of a search field row and select
**Delete**.

### Reordering search fields

Drag the handle on the left side of each row to change the field order. The order in the
configuration list matches the order in the end-user search panel.