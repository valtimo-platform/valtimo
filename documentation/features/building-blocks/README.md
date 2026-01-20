# Building blocks

Building blocks let you package a reusable part of a case process with its own data and configuration. You can use the same building block in multiple case definitions and across environments, while keeping a clear input and output contract.

{% hint style="info" %}
This feature is different from the Process Exchange building blocks that you download and copy into projects. For those, see [Process Exchange building blocks](../../fundamentals/process-exchange/building-blocks.md).
{% endhint %}

## When to use building blocks

Building blocks are useful when:

* The same subprocess is needed in multiple cases.
* You want one place to update a shared step.
* You want a consistent way to pass data in and get results back.

**Example:** A "Household verification" building block can be used in both subsidy and permit cases. Each case passes in the citizen data, the building block runs the checks, and the outcome is synced back to the case.

## How building blocks work

1. Create a building block definition (name, version, description).
2. Define the data it needs and the data it produces.
3. Add the processes and choose the main process.
4. Link the building block to a **Call activity** in a case process.
5. Map inputs and outputs, and choose when outputs are synced.

Building blocks are isolated by design. They should not directly read or write case data. Instead, you define the inputs and outputs when you link them to a case.

## Create a building block

### 1. Create the definition

* Go to **Admin** in the left sidebar.
* Select **Building blocks**.
* Click **Create**.
* Enter a **Name**, **Version**, and (optional) **Description**.
* Click **Save**.

<figure><img src="../../.gitbook/assets/building-block-create-modal.png" alt=""><figcaption><p>Create a new building block</p></figcaption></figure>

### 2. Add general information

* Open the **General** tab.
* Optionally upload **Artwork**.
* Review the list of **Plugins used** so you know which plugin types must be configured later. Initially, the list will be empty. This will be updated as you add plugins or other building blocks to the processes of your building block.

<figure><img src="../../.gitbook/assets/building-block-general.png" alt=""><figcaption><p>General information and artwork</p></figcaption></figure>

### 3. Define the data fields

* Open the **Document** tab.
* Add the fields the building block needs (inputs) and may return (outputs) and any other data the building block will need to use internally.
* Mark required fields so the case must provide them when using the building block.
* Click **Save**.

<figure><img src="../../.gitbook/assets/building-block-document.png" alt=""><figcaption><p>Define data fields for the building block</p></figcaption></figure>

### 4. Add processes

* Open the **Processes** tab.
* Either **Upload** a BPMN file or **Create** a new process.
* Select which process should be the **Main process** for the building block, or use the process that has been created with the building block.

<figure><img src="../../.gitbook/assets/building-block-processes.png" alt=""><figcaption><p>Processes inside the building block</p></figcaption></figure>

### 5. Finalize the version

Building blocks use **draft** and **final** versions, similar to case definitions.

* In the **More** menu, choose **Make version final** to lock the version.
* To make changes later, create a **new draft** from a final version.

Only **final** building blocks can be used when finalizing a case definition.

<figure><img src="../../.gitbook/assets/building-block-finalize.png" alt=""><figcaption><p>Finalize a building block version</p></figcaption></figure>

## Use a building block in a case

### 1. Add a Call activity

* Open the case process where you want to use the building block.
* Add a **Call activity** to the process model.

<figure><img src="../../.gitbook/assets/building-block-call-activity.png" alt=""><figcaption><p>Call activity in a case process</p></figcaption></figure>

### 2. Link the building block

* Open the **Process link** for the Call activity.
* Choose **Building block** as the link type.
* Select the building block and **Version** you want to use.

<figure><img src="../../.gitbook/assets/building-block-process-link-select.png" alt=""><figcaption><p>Select a building block and version</p></figcaption></figure>

### 3. Configure plugin mappings

If the building block uses plugins, you must map each **plugin type** to a **plugin configuration** that already exists in your environment.

* Select the configuration for each plugin type.
* If you are unsure, check the plugin documentation under [Plugins](../plugins/README.md).

<figure><img src="../../.gitbook/assets/building-block-plugin-mapping.png" alt=""><figcaption><p>Configure plugin mappings</p></figcaption></figure>

### 4. Map inputs and sync outputs

* Map **Inputs** from the case data to the building block fields.
* Map **Outputs** from the building block back to the case.
* Choose when outputs should be synced:
  * **Continuous**: keep the case up to date while the building block runs.
  * **At end**: only sync after the building block finishes.

<figure><img src="../../.gitbook/assets/building-block-input-output-mapping.png" alt=""><figcaption><p>Input and output mapping</p></figcaption></figure>

### 5. Save and deploy

* Click **Complete** to save the process link.
* Save and deploy the updated case process.

## Import and export building blocks

### Import

* Go to **Admin** → **Building blocks**.
* Click **Upload**.
* Select a `.zip` or `.json` export file and confirm the overwrite warning.
* Follow the steps in the wizard.

<figure><img src="../../.gitbook/assets/building-block-import.png" alt=""><figcaption><p>Import a building block definition</p></figcaption></figure>

### Export

* Open a building block.
* Click **More** → **Export**.

<figure><img src="../../.gitbook/assets/building-block-export.png" alt=""><figcaption><p>Export a building block definition</p></figcaption></figure>

{% hint style="info" %}
Before importing, make sure any required process definitions or plugin configurations already exist in your environment.
{% endhint %}
