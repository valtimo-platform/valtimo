# Document tags

The Document tags sub-tab manages reusable keywords ("trefwoorden") that can be attached to case documents.

A tag is a single free-text keyword. Tags are managed centrally on this sub-tab and can then be selected on individual documents elsewhere in the application.

{% hint style="info" %}
The Document tags sub-tab only appears when the case's configured Documenten API plugin version supports keywords. If the linked Documenten API plugin doesn't support this, the sub-tab is hidden entirely.
{% endhint %}

---

## Configuring ZGW document tags

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
Click the **ZGW** tab, then the **Document tags** sub-tab
{% endstep %}
{% endstepper %}

The list shows every configured tag. Use the search field to filter, and the checkboxes to select multiple tags for bulk actions.

{% hint style="info" %}
Document tags apply to the case definition as a whole. Changes affect every version of the case, not just the version currently selected.
{% endhint %}

### Creating a tag

{% stepper %}
{% step %}
Click **Create tag**
{% endstep %}
{% step %}
Enter a **Tag** value (up to 50 characters)
{% endstep %}
{% step %}
Click **Create**
{% endstep %}
{% endstepper %}

### Deleting tags

- To delete a single tag, use **Delete** from its overflow menu (⋮), then confirm
- To delete multiple tags at once, select their checkboxes and click **Delete** in the toolbar, then confirm

{% hint style="warning" %}
Deleting a tag cannot be undone. Documents that had the tag attached lose it.
{% endhint %}