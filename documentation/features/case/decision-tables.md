# Decision tables

Decision tables allow you to define business rules using DMN (Decision Model and Notation). Each case definition
version can have its own set of decision tables, which can be referenced from business rule tasks in the case's
processes.

{% hint style="info" %}
Building blocks can also have their own decision tables. See
[Building block decision tables](../building-blocks/decision-tables.md).
{% endhint %}

## Managing decision tables

### Deploying a decision table

* Open a case definition.
* Go to the **Decision tables** tab.
* Click **Upload**.
* Select a `.dmn` file.
* Click **Save**.

The decision table is now available to be used in business rule tasks in the case's processes.

### Editing a decision table

* Go to the **Decision tables** tab.
* Click on the decision table you want to edit.
* Make changes in the decision table editor.
* Click **Save**.

### Deleting a decision table

* Go to the **Decision tables** tab.
* Click the delete action on the decision table row.
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
