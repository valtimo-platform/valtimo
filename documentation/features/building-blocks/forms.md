# Forms

Building blocks can have their own form definitions, separate from case-level forms. These forms are scoped
to a specific building block version and can be used in user tasks within the building block's processes.

## Managing forms

### Creating a form

* Open a building block definition.
* Go to the **Forms** tab.
* Click **Create**.
* Enter a **Name** for the form.
* Build the form using the Form.io form builder.
* Click **Save**.

The form is now available to be linked to user tasks in the building block's processes.

### Uploading a form

* Open a building block definition.
* Go to the **Forms** tab.
* Click the **Upload** button.
* Enter a **Name** and upload the Form.io JSON definition.
* Click **Save**.

### Editing a form

* Open a building block definition.
* Go to the **Forms** tab.
* Click on the form you want to edit.
* Make changes in the form builder.
* Click **Save**.

### Deleting a form

* Open a building block definition.
* Go to the **Forms** tab.
* Click the delete action on the form row.
* Confirm the deletion.

{% hint style="warning" %}
Forms cannot be created, edited, or deleted when the building block version is finalized. To make changes,
create a new draft version from the finalized version.
{% endhint %}

## Using forms in user tasks

Once a form is created for a building block, it can be linked to user tasks in the building block's processes
through form process links.

1. Open the building block's process in the process editor.
2. Select a **User task** in the process model.
3. Open the **Process link** configuration.
4. Choose **Form** as the link type.
5. Select the form you created in the building block's Forms tab.
6. Click **Save**.

Tasks from building block processes automatically appear in the case task list when the building block is
used within a case. If the case has an assignee and auto-assignment is enabled, building block tasks are
automatically assigned to the case assignee.

## Value resolvers

When building forms for a building block, the value resolver selector in the form builder shows the data
fields available within the building block's own document.

## Import and export

Building block forms are automatically included when exporting a building block. When importing a building
block, any forms included in the export are restored. If a form with the same name already exists, it is
updated with the imported definition.

The export path for forms follows this structure:

```
config/building-block/<key>/<version>/form/<name>.form.json
```
