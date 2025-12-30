# ✅ Tasks

As part of a case process, some tasks need to be manually completed by a person. These tasks are called user tasks and often require some input of data or approval.

Valtimo only shows tasks to a user that have not been completed yet. They can be accessed via the case the task belongs to, or `Tasks` in the main menu.

<figure><img src="https://valtimo.gitbook.io/valtimo-documentation/~gitbook/image?url=https%3A%2F%2F181910120-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FG21VIGcgPc1cyGRZY5CR%252Fuploads%252Fgit-blob-8dd87abe9e8092b0f1782acba5660fddeafdc271%252Ftasks-menu.png%3Falt%3Dmedia&#x26;width=768&#x26;dpr=4&#x26;quality=100&#x26;sign=8e40f6ff&#x26;sv=2" alt=""><figcaption><p>Tasks menu</p></figcaption></figure>

The `Tasks` menu item brings the user to a task list view, which combines tasks from different cases. The available categories are:

* **My tasks:** These are tasks that have been assigned to the current user.
* **Unassigned tasks:** These tasks have not been assigned to any user.
* **All tasks** This view shows all tasks regardless of assignment.

<figure><img src="https://valtimo.gitbook.io/valtimo-documentation/~gitbook/image?url=https%3A%2F%2F181910120-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FG21VIGcgPc1cyGRZY5CR%252Fuploads%252Fgit-blob-86d4b83c0fcdd30e85677c78dff21df2a6a9382a%252Ftask-tabs.png%3Falt%3Dmedia&#x26;width=768&#x26;dpr=4&#x26;quality=100&#x26;sign=318ba274&#x26;sv=2" alt=""><figcaption><p>Task tabs</p></figcaption></figure>

When clicking on a task from the list, it will open the form that the user can fill in to complete it. After completion, the task will no longer be visible to the user.

A user can filter the tasks by case via the top dropdown:

* **When no case is selected**: tasks from all cases is shown. This view uses the task columns as configured in code. These columns cannot be changed via the UI.
* **When a case is selected**: the tasks are filtered by that case, and the columns as configured for that case are shown. For more information on configuring task list columns for a case, click [here](https://valtimo.gitbook.io/valtimo-documentation/using-valtimo/tasks/task-list-columns)

## Columns

Task list columns can be configured to change the visible columns in the task list.

{% tabs %}
{% tab title="Via UI" %}
* Go to the `Admin`  menu
* Go to the `Tasks`  menu
* Select the case to configure task list columns for

{% hint style="info" %}
The configured task list columns will only be available for the selected case.
{% endhint %}

From here, it is possible to:

* Add columns
* Edit columns
* Sort columns
* Delete columns

### Adding a column

A column can be added by clicking on the **Add column** button. This will open the following modal:&#x20;

<figure><img src="https://valtimo.gitbook.io/valtimo-documentation/~gitbook/image?url=https%3A%2F%2F181910120-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FG21VIGcgPc1cyGRZY5CR%252Fuploads%252Fgit-blob-a712fd84698a2df44f06dd35179cc4adc6fe57c3%252Fadd-task-list-column.png%3Falt%3Dmedia&#x26;width=300&#x26;dpr=4&#x26;quality=100&#x26;sign=c8605b88&#x26;sv=2" alt=""><figcaption><p>Add task list column</p></figcaption></figure>

* **Title**\
  If this field is filled in, this title will display as the column header, overriding any available translations.
* **Key**\
  A unique key by which the column is identified. If the key is not unique, you will not be able to save the column.
* **Path**\
  A path which leads to the property you want to show. For the document's JSON schema, follow this example: `doc:customer.firstName`. For document properties, follow these examples: `case:createdBy`, or `case:sequence`, or `case:assigneeFullName`.&#x20;

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
Task list columns can be autodeployed by adding json files on the classpath. These files should end with `.case-task-list.json` to be eligible for autodeployment.

Every deployment file represents a changeset. These files are required to contain a `changesetId` that should be unique over all deployment files that use changesets. When starting up, changesets that have already been executed will be ignored. A checksum of the changeset is created when it is executed. Changesets that have already been deployed should not change. Changesets that have been changed since a previous time will result in an error and failure to start the application.

All changesets can be executed again, even when the content has changed, by setting the `valtimo.changelog.case-task-list.clear-tables` property to `true`. By default, this setting is disabled.

{% code title="my-case.case-task-list.json" %}
```json
{
  "changesetId": "my-case.case-task-list",
  "case-definitions": [
    {
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
```
{% endcode %}
{% endtab %}
{% endtabs %}

### Available properties

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

## Search fields

Task filters enable users to search tasks that meet one or more of the configured criteria. These filters can be configured by an admin.

### Configuring task search fields

{% tabs %}
{% tab title="Via UI" %}
* Go to the `Admin`  menu
* Go to the `Tasks`  menu
* Select the case to configure serach fields for

{% hint style="info" %}
The configured task search fields will only be available for the selected case.
{% endhint %}

On the `Search fields` tab, search fields can be added, edited or removed.&#x20;

<figure><img src="https://valtimo.gitbook.io/valtimo-documentation/~gitbook/image?url=https%3A%2F%2F181910120-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FG21VIGcgPc1cyGRZY5CR%252Fuploads%252Fgit-blob-889518249305f8f5e519bce7bcc83a16cd6b21e8%252Ftask-search-fields-list.png%3Falt%3Dmedia&#x26;width=300&#x26;dpr=4&#x26;quality=100&#x26;sign=fd8f962f&#x26;sv=2" alt=""><figcaption><p>Task search field configuration</p></figcaption></figure>

When adding or editing a search field, the available options are similar to the case search fields. More information on case search fields can be found [here](case/search-fields.md).

For task list filters the following path prefixes are available:

* `doc:`
* `case:`
{% endtab %}

{% tab title="Via IDE" %}
Task search fields can be autodeployed by creating json files on the classpath following this pattern: `classpath*:**/*.task-search-field.json`. The name of the file does not matter, but it is advised to keep it in line with the object title.

You can find an example of the JSON below:

{% code title="my-case.task-search-field.json" %}
```json
{
  "changesetId": "my-case.TaskListSearchColumns.1721390529320",
  "collection": [
    {
      "ownerId": "my-case",
      "searchFields": [
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
    }
  ]
}
```
{% endcode %}

More information on the available fields and values can be found [here](case/for-developers/configuring-search-fields.md).
{% endtab %}
{% endtabs %}

### Using task search fields <a href="#using-task-filters" id="using-task-filters"></a>

Since task filters are configured on a case, they will only be available when the user selects a case from the dropdown. For 'All cases', the additional filters will not be available.

With these filters, a user can filter on data from the document or case the task relates to.&#x20;

<figure><img src="https://valtimo.gitbook.io/valtimo-documentation/~gitbook/image?url=https%3A%2F%2F181910120-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FG21VIGcgPc1cyGRZY5CR%252Fuploads%252Fgit-blob-066e42c04c49f362d4352fa74993dec9c6e4f2a1%252Ftask-list-filter-user.png%3Falt%3Dmedia&#x26;width=300&#x26;dpr=4&#x26;quality=100&#x26;sign=6ba20fa2&#x26;sv=2" alt=""><figcaption><p>Task search field</p></figcaption></figure>

Just like the case search filters, these filters will behave differently depending on how the admin configured the fields.

{% hint style="info" %}
**Note**

The current search criteria can be shared with another user by copying the url from the address bar. The same filter criteria will be applied, but results may vary depending on access control for the other user.
{% endhint %}

## Import and export

The configurations for task list columns and task search fields are included in the case definition import and export by default.

## Access control

Access to the processes can be configured through access control. More information about access control can be found [here](access-control/).

### Resources and actions

<table><thead><tr><th width="329">Resource type</th><th width="143">Action</th><th>Effect</th></tr></thead><tbody><tr><td><code>com.ritense.valtimo.camunda.domain.CamundaTask</code></td><td><code>assign</code></td><td>Allows assigning users to a task.</td></tr><tr><td></td><td><code>assignable</code></td><td>Allows users to be assigned to a task.</td></tr><tr><td></td><td><code>claim</code></td><td>Allows claiming of a task.</td></tr><tr><td></td><td><code>complete</code></td><td>Allows completion of a task.</td></tr><tr><td></td><td><code>view</code></td><td>Allows viewing of a task.</td></tr><tr><td></td><td><code>view_list</code></td><td>Allows viewing of tasks.</td></tr><tr><td><code>com.ritense.valtimo.camunda.domain.CamundaIdentityLink</code></td><td></td><td></td></tr></tbody></table>

Task identity links have no actions currently. As a result, they can only be used as part of container conditions. See the example here on how to use this.

### Examples

<details>

<summary>Permission to complete a task of one candidate group</summary>

{% code overflow="wrap" %}
```json
{
    "resourceType": "com.ritense.valtimo.camunda.domain.CamundaTask",
    "action": "view",
    "conditions": [
        {
            "type": "container",
            "resourceType": "com.ritense.valtimo.camunda.domain.CamundaIdentityLink",
            "conditions": [
                {
                    "type": "field",
                    "field": "groupId",
                    "operator": "==",
                    "value": "ROLE_USER"
                }
            ]
        }
    ]
}
```
{% endcode %}

</details>

<details>

<summary>Permission to claim a task if unassigned</summary>

{% code overflow="wrap" %}
```json
{
    "resourceType": "com.ritense.valtimo.camunda.domain.CamundaTask",
    "action": "claim",
    "conditions": [
        {
            "type": "field",
            "field": "assigneeId",
            "operator": "==",
            "value": null
        }
    ]
}
```
{% endcode %}

</details>
