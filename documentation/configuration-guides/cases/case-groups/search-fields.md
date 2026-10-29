# Search fields

{% hint style="success" %}
Available since Valtimo `13.52.0`
{% endhint %}

Search fields determine which filters are available in the case list of a case group. Like list
columns, each search field has one path per case definition, so one filter searches the right
field in every case definition of the group.

---

## Configuring search fields

{% stepper %}
{% step %}
Go to **Admin** > **Cases** and click the **Case groups** tab
{% endstep %}
{% step %}
Click a case group to open it
{% endstep %}
{% step %}
Click the **Search fields** tab

<figure><img src="../../../assets/configuration-guides/cases/case-groups/08-search-fields.png" alt=""><figcaption>Search fields</figcaption></figure>
{% endstep %}
{% endstepper %}

The list shows all search fields with their name, key, data type, field type, and match type.
Click the arrow in front of a search field to see its path for each case definition.

### Creating a search field

{% stepper %}
{% step %}
Click **Add**
{% endstep %}
{% step %}
Fill in the title. The key is generated from the title; click the pencil icon to change it.
{% endstep %}
{% step %}
Fill in a path for each case definition

<figure><img src="../../../assets/configuration-guides/cases/case-groups/09-add-search-field-modal.png" alt=""><figcaption>Add search field</figcaption></figure>
{% endstep %}
{% step %}
Select the data type, field type, and, optionally, the match type
{% endstep %}
{% step %}
Click **Save**
{% endstep %}
{% endstepper %}

#### Search field properties

| Property | Description |
|----------|-------------|
| Title | Label of the search field in the case list |
| Key | Unique identifier of the search field within the group. Generated from the title. |
| Path (per case definition) | Path to the value to search on for each case definition. Only `doc:` and `case:` paths can be searched. |
| Data type | Type of the value: text, number, date, datetime, or boolean |
| Field type | How the user enters the search value: single, range, single-select-dropdown, or multi-select-dropdown |
| Match type | Optional. **exact** finds only identical values; **like** also finds partial matches. |
| Dropdown data provider | Optional. Source of the options for a dropdown field type. |

{% hint style="info" %}
Dropdown field types are only available for the text data type. The boolean data type only
supports the single field type.
{% endhint %}

### Editing or deleting a search field

Click the overflow menu (**⋮**) of a search field and select **Edit** or **Delete**.

### Reordering search fields

Drag the handle in front of a search field to change its position in the search panel of the case
list. Reordering is not available while the search field above the list is in use.
