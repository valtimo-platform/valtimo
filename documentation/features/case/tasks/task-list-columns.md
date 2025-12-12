# Columns

Task list columns can be configured to change the visible columns in the task list.

{% tabs %}
{% tab title="Via UI" %}
* Go to the `Admin` menu
* Go to the `Tasks` menu
* Select the case to configure task list columns for

{% hint style="info" %}
The configured task list columns will only be available for the selected case.
{% endhint %}

From here, it is possible to:

* Add columns
* Edit columns
* Sort columns
* Delete columns

#### Adding a column

A column can be added by clicking on the **Add column** button. This will open the following modal:

<figure><img src="https://valtimo.gitbook.io/valtimo-documentation/~gitbook/image?url=https%3A%2F%2F181910120-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FG21VIGcgPc1cyGRZY5CR%252Fuploads%252Fgit-blob-a712fd84698a2df44f06dd35179cc4adc6fe57c3%252Fadd-task-list-column.png%3Falt%3Dmedia&#x26;width=300&#x26;dpr=4&#x26;quality=100&#x26;sign=c8605b88&#x26;sv=2" alt=""><figcaption><p>Add task list column</p></figcaption></figure>

* **Title**\
  If this field is filled in, this title will display as the column header, overriding any available translations.
* **Key**\
  A unique key by which the column is identified. If the key is not unique, you will not be able to save the column.
* **Path**\
  A path which leads to the property you want to show. For the document's JSON schema, follow this example: `doc:customer.firstName`. For document properties, follow these examples: `case:createdBy`, or `case:sequence`, or `case:assigneeFullName`.

{% hint style="info" %}
**Note**

When there are special characters in a property, the property must be enclosed in quotes. For example: case:"loan-accepted".
{% endhint %}

* **Display type**\
  This option decides how the data is eventually displayed in the table.
* **Sortable**\
  Whether the column will be sortable by the user
* **Default Sort**\
  If this field has a value, the table will be sorted by default on this property, in the direction specified. Only one column at a time can have this property. On creating a new column, if another column already has a default sort specified, this input field will be disabled.
{% endtab %}

{% tab title="Via IDE" %}
Task list columns can be auto-deployed by adding json files on the classpath. These files should end with `.case-task-list.json` to be eligible for auto-deployment.

{% code title="my-case.case-task-list.json" %}
```json
[
    {
        "title": "First name",
        "key": "first-name",
        "path": "doc:first-name",
        "displayType": {
            "type": "text",
            "displayTypeParameters": {}
        },
        "sortable": false
    },
    {
        "title": "Last name",
        "key": "last-name",
        "path": "doc:last-name",
        "displayType": {
            "type": "text",
            "displayTypeParameters": {}
        },
        "sortable": true,
        "defaultSort": "ASC"
    }
]
```
{% endcode %}
{% endtab %}
{% endtabs %}

## Available properties

The following properties can be shown in the task list:

* Properties from the document, with the '`doc:`' prefix. E.g.: `doc:first-name`
* Properties from the task, with the `task:` prefix. The following properties are available:
  * `createTime`
  * `name`
  * `assignee`
  * `dueDate`

{% hint style="info" %}
Starting `Valtimo 12.6.0` the 'variable' property can be used in the task list. Using the variable property, process variables that exist in the process instance of the task can be shown. A variable property can be configured using the `task:variable.firstName` notation.
{% endhint %}

## Import and export

The configuration task list columns is included in the case definition import and export by default.
