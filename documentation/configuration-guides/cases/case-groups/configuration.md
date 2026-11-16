# General

{% hint style="success" %}
Available since Valtimo `13.53.0`
{% endhint %}

The **General** tab of a case group defines which case definitions belong to the group and which
color represents the group in the Cases overview and the left sidebar.

---

## Configuring general settings

{% stepper %}
{% step %}
Expand **Admin** in the left sidebar
{% endstep %}
{% step %}
Click **Cases** under the Configuration section
{% endstep %}
{% step %}
Click the **Case groups** tab
{% endstep %}
{% step %}
Click a case group to open it
{% endstep %}
{% step %}
Click the **General** tab

<figure><img src="../../../assets/configuration-guides/cases/case-groups/12-general-tab-overview.png" alt=""><figcaption>General tab overview</figcaption></figure>
{% endstep %}
{% endstepper %}

---

## Creating a case group

{% stepper %}
{% step %}
Expand **Admin** in the left sidebar
{% endstep %}
{% step %}
Click **Cases** under the Configuration section
{% endstep %}
{% step %}
Click the **Case groups** tab
{% endstep %}
{% step %}
Click **Create**
{% endstep %}
{% step %}
Fill in the name and, optionally, a description

<figure><img src="../../../assets/configuration-guides/cases/case-groups/02-create-group-modal.png" alt=""><figcaption>Create case group</figcaption></figure>
{% endstep %}
{% step %}
Click **Create**
{% endstep %}
{% endstepper %}

| Property | Description |
|----------|-------------|
| Name | Display name of the case group. Required. |
| Description | Short explanation shown on the case group tile in the Cases overview. Optional. |

The key of the case group is generated from the name (for example, `citizen_requests` for
"Citizen requests") and cannot be changed.

### Editing a case group

{% stepper %}
{% step %}
Open the case group
{% endstep %}
{% step %}
Click **Edit** in the header
{% endstep %}
{% step %}
Change the name or description
{% endstep %}
{% step %}
Click **Save**
{% endstep %}
{% endstepper %}

---

## Choosing a group color

The **Group color** panel sets the color used for the case group tile in the Cases overview and
for the dot in front of the pinned case group in the left sidebar.

<figure><img src="../../../assets/configuration-guides/cases/case-groups/03-group-color.png" alt=""><figcaption>Group color</figcaption></figure>

Click one of the predefined colors, or click the square next to **Choose your own color** to pick
any color. The color is saved immediately and a confirmation appears.

Click **Remove color** to clear the color. The case group then shows the neutral gray dot again.

{% hint style="info" %}
Case definitions have a color of their own. It is set in the **Case color** panel on the
[General](../general.md) tab of the case definition.
{% endhint %}

---

## Adding case definitions

{% stepper %}
{% step %}
Click **Add case definition**
{% endstep %}
{% step %}
Select a case definition

<figure><img src="../../../assets/configuration-guides/cases/case-groups/04-add-case-definition.png" alt=""><figcaption>Add case definition</figcaption></figure>
{% endstep %}
{% step %}
Click **Add to group**
{% endstep %}
{% endstepper %}

The table lists all case definitions in the group with their name and key. Use the
**Filter case definitions...** field to search the table.

<figure><img src="../../../assets/configuration-guides/cases/case-groups/05-group-members.png" alt=""><figcaption>Case definitions in a case group</figcaption></figure>

{% hint style="warning" %}
As long as no list columns are configured, the case group shows the warning **No list columns
configured** and its case list shows no case data. Add list columns on the
[List columns](list-columns.md) tab.
{% endhint %}

### Removing a case definition

{% stepper %}
{% step %}
Click the overflow menu (**⋮**) of a case definition
{% endstep %}
{% step %}
Select **Delete**
{% endstep %}
{% endstepper %}

The case definition is removed from the group immediately, without a confirmation. The case definition itself and its
cases are not affected.

---

## Deleting a case group

{% stepper %}
{% step %}
Open the case group
{% endstep %}
{% step %}
Click **Delete** in the page header
{% endstep %}
{% step %}
Click **Delete** in the **Delete case group** dialog to confirm
{% endstep %}
{% endstepper %}

{% hint style="warning" %}
Deleting a case group cannot be undone. Its list columns, search fields and saved searches are
removed, and it disappears from every user's pinned items. The case definitions in the group and
their cases are not affected.

To keep a copy of the configuration, [export the case group](README.md#exporting-a-case-group)
first.
{% endhint %}
