# Decision tables

Decision tables allow you to define business rules using DMN (Decision Model and Notation). Each case definition
version can have its own set of decision tables, which can be referenced from business rule tasks in the case's
processes.

{% hint style="info" %}
Building blocks can also have their own decision tables. See
[Building block decision tables](../building-blocks/decision-tables.md).
{% endhint %}

## Managing decision tables

{% hint style="warning" %}
Decision tables can only be created, edited, or deleted on a **draft** case definition version. On a finalized
version these actions are shown but disabled — create a new draft version to make changes.
{% endhint %}

### Creating a decision table

* Open a case definition.
* Go to the **Decision tables** tab.
* Click **Create DMN table**.
* Enter a **name** for the decision table.
* Optionally add one or more **input columns**. Each column takes a **process variable** (required) and an optional
  **label** used as the column header — when the label is left blank, the process variable name is used.
* Click **Create**. The decision table opens in the editor, seeded with the input columns you provided.
* Add your rules and click **Save** to deploy it.

### Deploying a decision table

* Open a case definition.
* Go to the **Decision tables** tab.
* Click **Upload**.
* Select a `.dmn` file.
* Click **Save**.

The decision table is now available to be used in business rule tasks in the case's processes.

### Editing a decision table

There are two ways to edit a decision table:

* **Full editor** — click on the decision table row to open the DMN editor, make your changes and click **Save**.
* **Quick edit** — use the **Edit** action in the row's overflow menu (or the editor's top-right overflow menu) to
  change the **name** and **input columns** without opening the full grid.

### Deleting a decision table

* Go to the **Decision tables** tab.
* Click the **Delete** action in the decision table row's overflow menu (or in the editor's top-right overflow menu).
* Confirm the deletion.

## Using decision tables in processes

Once a decision table is deployed for a case definition, it can be referenced from a **Business rule task** in the
case's process model.

1. Open the case's process in the process editor.
2. Add a **Business rule task** to the process model.
3. Set the **Decision ref** to the decision table key.
4. Configure the input and output mappings as needed.

## Auto-deployment

Decision tables can be auto-deployed by placing `.dmn` files in the case definition's resource directory:

```
config/case/<case-definition-key>/<version>/dmn/<decision-name>.dmn
```

These files are automatically imported when the case definition is deployed.

## Import and export

Decision tables are automatically included when exporting a case definition. When importing a case definition, any
decision tables included in the export are restored.
