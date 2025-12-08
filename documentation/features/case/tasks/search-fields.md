# Search fields

Task filters enable users to search tasks that meet one or more of the configured criteria. These filters can be configured by an admin.

## Configuring task search fields

{% tabs %}
{% tab title="Via UI" %}
* Go to the `Admin`  menu
* Go to the `Tasks`  menu
* Select the case to configure search fields for

{% hint style="info" %}
The configured task search fields will only be available for the selected case.
{% endhint %}

On the `Search fields` tab, search fields can be added, edited or removed.&#x20;

<figure><img src="https://valtimo.gitbook.io/valtimo-documentation/~gitbook/image?url=https%3A%2F%2F181910120-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FG21VIGcgPc1cyGRZY5CR%252Fuploads%252Fgit-blob-889518249305f8f5e519bce7bcc83a16cd6b21e8%252Ftask-search-fields-list.png%3Falt%3Dmedia&#x26;width=300&#x26;dpr=4&#x26;quality=100&#x26;sign=fd8f962f&#x26;sv=2" alt=""><figcaption><p>Task search field configuration</p></figcaption></figure>

When adding or editing a search field, the available options are similar to the case search fields. More information on case search fields can be found [here](../case-list/search-fields.md).

For task list filters the following path prefixes are available:

* `doc:`
* `case:`
{% endtab %}

{% tab title="Via IDE" %}
Task search fields can be auto-deployed by creating json files on the classpath following this pattern: `classpath*:**/*.task-search-field.json`. The name of the file does not matter, but it is advised to keep it in line with the object title.

You can find an example of the JSON below:

{% code title="my-case.task-search-field.json" %}
```json
[
    {
        "key": "caseAssignee",
        "title": "Case assignee",
        "path": "case:assigneeFullName",
        "dataType": "TEXT",
        "fieldType": "SINGLE",
        "matchType": "LIKE"
    },
    {
        "key": "createdBy",
        "title": "Case created by",
        "path": "case:createdBy",
        "dataType": "TEXT",
        "fieldType": "SINGLE",
        "matchType": "LIKE"
    }
]
```
{% endcode %}

More information on the available fields and values can be found [here](../for-developers/configuring-search-fields.md).
{% endtab %}
{% endtabs %}

## Using task search fields <a href="#using-task-filters" id="using-task-filters"></a>

Since task filters are configured on a case, they will only be available when the user selects a case from the dropdown. For 'All cases', the additional filters will not be available.

With these filters, a user can filter on data from the document or case the task relates to.&#x20;

<figure><img src="https://valtimo.gitbook.io/valtimo-documentation/~gitbook/image?url=https%3A%2F%2F181910120-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FG21VIGcgPc1cyGRZY5CR%252Fuploads%252Fgit-blob-066e42c04c49f362d4352fa74993dec9c6e4f2a1%252Ftask-list-filter-user.png%3Falt%3Dmedia&#x26;width=300&#x26;dpr=4&#x26;quality=100&#x26;sign=6ba20fa2&#x26;sv=2" alt=""><figcaption><p>Task search field</p></figcaption></figure>

Just like the case search filters, these filters will behave differently depending on how the admin configured the fields.

{% hint style="info" %}
**Note**

The current search criteria can be shared with another user by copying the url from the address bar. The same filter criteria will be applied, but results may vary depending on access control for the other user.
{% endhint %}

## Import and export

The configuration task search fields is included in the case definition import and export by default.
