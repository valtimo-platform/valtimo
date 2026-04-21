# Decision tables

Building blocks can have their own DMN decision tables, separate from case-level decision tables. These decision
tables are scoped to a specific building block version and can be used in business rule tasks within the building
block's processes.

## Managing decision tables

### Deploying a decision table

* Open a building block definition.
* Go to the **Decision tables** tab.
* Click the **Upload** button.
* Select a `.dmn` file.
* Click **Save**.

The decision table is now available to be used in business rule tasks in the building block's processes.

### Editing a decision table

* Open a building block definition.
* Go to the **Decision tables** tab.
* Click on the decision table you want to edit.
* Make changes in the decision table editor.
* Click **Save**.

### Deleting a decision table

* Open a building block definition.
* Go to the **Decision tables** tab.
* Click the delete action on the decision table row.
* Confirm the deletion.

{% hint style="warning" %}
Decision tables cannot be created, edited, or deleted when the building block version is finalized. To make changes,
create a new draft version from the finalized version.
{% endhint %}

## Using decision tables in business rule tasks

Once a decision table is deployed in a building block, it can be referenced from a **Business rule task** in the
building block's process model.

1. Open the building block's process in the process editor.
2. Add a **Business rule task** to the process model.
3. Set the **Decision ref** to the decision table key.
4. Configure the input and output mappings as needed.

## Import and export

Building block decision tables are automatically included when exporting a building block. When importing a building
block, any decision tables included in the export are restored.

The export path for decision tables follows this structure:

```
config/building-block/<key>/<version>/dmn/<decision-name>.dmn
```
