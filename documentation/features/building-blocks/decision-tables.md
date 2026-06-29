# Decision tables

Building blocks can have their own DMN decision tables, separate from case-level decision tables. These decision
tables are scoped to a specific building block version and can be used in business rule tasks within the building
block's processes.

## Managing decision tables

### Creating a decision table

* Open a building block definition.
* Go to the **Decision tables** tab.
* Click **Create DMN table**.
* Enter a **name** for the decision table.
* Optionally add one or more **input columns**. Each column takes a **process variable** (required) and an optional
  **label** used as the column header — when the label is left blank, the process variable name is used.
* Click **Create**. The decision table opens in the editor, seeded with the input columns you provided.
* Add your rules and click **Save** to deploy it.

### Deploying a decision table

* Open a building block definition.
* Go to the **Decision tables** tab.
* Click the **Upload** button.
* Select a `.dmn` file.
* Click **Save**.

The decision table is now available to be used in business rule tasks in the building block's processes.

### Editing a decision table

There are two ways to edit a decision table:

* **Full editor** — click on the decision table row to open the DMN editor, make your changes and click **Save**.
* **Quick edit** — use the **Edit** action in the row's overflow menu (or the editor's top-right overflow menu) to
  change the **name** and **input columns** without opening the full grid.

### Deleting a decision table

* Open a building block definition.
* Go to the **Decision tables** tab.
* Click the **Delete** action in the decision table row's overflow menu (or in the editor's top-right overflow menu).
* Confirm the deletion.

{% hint style="warning" %}
Decision tables can only be created, edited, or deleted on a draft building block version. On a finalized version
these actions are shown but disabled — create a new draft version from the finalized version to make changes.
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
