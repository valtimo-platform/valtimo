# Task list columns

Task list columns can be configured to change the visible columns in the task list.

## Available list columns

The following properties can be shown in the task list:

* Properties from the document, with the '`doc:`' prefix. E.g.: `doc:first-name`
* Properties from the task, with the '`task:`' prefix. The following properties are available:
  * `createTime`
  * `name`
  * `assignee`
  * `dueDate`

{% hint style="info" %}
Starting Valtimo 12.6.0, the 'variable' property can be used in the task list. Using the variable property, process variables that exist in the process instance of the task can be shown. A variable property can be configured using the `task:variable.firstName` notation.
{% endhint %}

## Configuring task list columns

{% tabs %}
{% tab title="Via UI" %}
To be documented.
{% endtab %}

{% tab title="Via IDE" %}
#### Auto-deployment

Task list columns can be auto-deployed by adding json files on the classpath. These files should end with `.case-task-list.json` to be eligible for auto-deployment.

**my-case.case-task-list.json**:

<pre class="language-json"><code class="lang-json">{
  "changesetId": "my-case.case-task-list",
<strong>  "case-definitions": [
</strong>    {
      "key": "my-case",
      "columns": [
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
    }
  ]
}
</code></pre>
{% endtab %}
{% endtabs %}
