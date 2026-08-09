# Cases

## Overview

The Cases configuration area lets you manage case definitions — the templates that define how
different types of cases behave in your Valtimo implementation. Each case definition specifies
its document structure, linked processes, forms, and how it appears to end users.

From here you can configure:

- **[General](general.md)** — Case handler settings and external start form
- **[Processes](processes.md)** — BPMN process definitions linked to the case
- **[Actions](actions.md)** — Startable items (processes and building blocks) users can trigger from a case
- **[Decision tables](decision-tables.md)** — DMN decision tables for automated decisions
- **[Document](document.md)** — JSON schema defining the case's data structure
- **[Forms](forms.md)** — Form definitions available for the case
- **[Form flows](form-flows.md)** — Multi-step form sequences
- **[Tasks](tasks/README.md)** — Task list column and search field configuration
- **[Case list](case-list/README.md)** — End-user case list columns and search fields
- **[Case details](case-details/README.md)** — Tabs, statuses, tags, and header configuration
- **[ZGW](zgw/README.md)** — Dutch government standards integration

---

## Configuring cases

{% stepper %}
{% step %}
Expand **Admin** in the left sidebar
{% endstep %}
{% step %}
Click **Cases** under the Configuration section

![Admin sidebar with Cases navigation](../../assets/configuration-guides/cases/01-admin-cases-navigation.png)
{% endstep %}
{% step %}
Click a case row to open its configuration
{% endstep %}
{% step %}
Use the tabs to navigate between configuration areas

![Case configuration tabs](../../assets/configuration-guides/cases/02-case-configuration-tabs.png)
{% endstep %}
{% endstepper %}

The cases list shows all defined case types with their name, key, current version, and status.
Cases marked "Needs configuration" have unresolved configuration issues that should be addressed.

### Creating a case

To create a new case definition from scratch:

{% stepper %}
{% step %}
Click the **Create** button in the toolbar
{% endstep %}
{% step %}
Fill in the case definition details:

![Create case definition modal](../../assets/configuration-guides/cases/03-create-modal-empty.png)

- **Name** — Display name for the case definition
- **Key** — Unique identifier (auto-generated from name, can be edited)
- **Version** — Semantic version number (e.g., `1.0.0`)
- **Description** — Optional description of what this case type handles

![Create case definition with filled fields](../../assets/configuration-guides/cases/04-create-modal-filled.png)
{% endstep %}
{% step %}
Click **Save** to create the case definition
{% endstep %}
{% endstepper %}

The new case opens in draft mode, ready for configuration.

### Uploading a case

To import an existing case definition package:

{% stepper %}
{% step %}
Click the **Upload** button in the toolbar
{% endstep %}
{% step %}
Select a `.zip` file containing the case definition

![Upload case definition file select](../../assets/configuration-guides/cases/05-upload-modal-file-select.png)
{% endstep %}
{% step %}
Configure the import settings:
- Review or modify the case name and key
- Map plugin configurations if the package uses plugins
{% endstep %}
{% step %}
Click **Next** to proceed through the wizard steps
{% endstep %}
{% step %}
Click **Start upload** to import the case definition
{% endstep %}
{% endstepper %}

---

## Version management

Case definitions support versioning. The version selector in the header shows the current version
and allows switching between versions.

Click the **Version management** button to access version management options.The deployment page shows version information and provides actions depending on the version status:

![Version selector dropdown](../../assets/configuration-guides/cases/06-version-selector-dropdown.png)

#### For published versions

- **Create draft version** — Create a new draft version based on this published version

![Published version deployment](../../assets/configuration-guides/cases/10-deployment-published.png)

#### For draft versions

- **Finalize draft** — Publish the draft version (makes it available for new cases)
- **Delete draft** — Remove the draft version

![Draft version deployment](../../assets/configuration-guides/cases/08-deployment-draft.png)

### Viewing all versions

Click **Show all versions** in the version selector to see a complete list of all versions for
the case definition. This opens a modal with a paginated table showing all versions and their
status (draft or published).

![Show all versions modal](../../assets/configuration-guides/cases/13-show-all-versions-modal.png)

{% hint style="info" %}
Most configuration changes are version-specific. When you modify a setting, it applies to the
selected version only.
{% endhint %}

### Creating a draft version

To create a new draft version from a published version:

{% stepper %}
{% step %}
Navigate to the deployment page of a published version
{% endstep %}
{% step %}
Click **Create draft version**
{% endstep %}
{% step %}
Fill in the new version details:

![Create draft version modal](../../assets/configuration-guides/cases/11-create-draft-modal.png)

- **Name** — Display name for the case definition
- **Key** — Unique identifier (cannot be changed)
- **Version** — New version number (e.g., `1.1.0`)
- **Description** — Optional description of what this version changes
{% endstep %}
{% step %}
Click **Save** to create the draft
{% endstep %}
{% endstepper %}

The new draft version opens in edit mode, ready for configuration changes.

### Finalizing a draft version

To publish a draft version:

{% stepper %}
{% step %}
Navigate to the deployment page of the draft version
{% endstep %}
{% step %}
Click **Finalize draft**
{% endstep %}
{% step %}
Review the confirmation message

![Finalize confirmation modal](../../assets/configuration-guides/cases/09-finalize-confirmation.png)
{% endstep %}
{% step %}
Click **Finalize** to publish
{% endstep %}
{% endstepper %}

{% hint style="warning" %}
After finalization, the version becomes read-only. Create a new draft to make further changes.
{% endhint %}

### Deleting a draft version

To delete a draft version:

{% stepper %}
{% step %}
Navigate to the deployment page of the draft version
{% endstep %}
{% step %}
Click **Delete draft**
{% endstep %}
{% step %}
Confirm the deletion in the modal
{% endstep %}
{% endstepper %}

{% hint style="warning" %}
Deleting a draft cannot be undone. All configuration changes in the draft will be lost.
{% endhint %}

### Setting the globally active version

The globally active version determines which version is used when creating new cases. To change it:

{% stepper %}
{% step %}
Select the version you want to activate
{% endstep %}
{% step %}
Click the **More** menu
{% endstep %}
{% step %}
Select **Set as active version**

![More menu with Set as active version option](../../assets/configuration-guides/cases/12-more-menu.png)
{% endstep %}
{% step %}
Confirm the change in the modal
{% endstep %}
{% endstepper %}

{% hint style="warning" %}
Setting an older version as globally active may affect new case creation if the older version
lacks features or fields present in newer versions.
{% endhint %}

---

## Access control

Case access is controlled through the access control system. See [Access control](../access-control/README.md) for details on configuring permissions.

| Resource type                                        | Action      | Description                    |
|------------------------------------------------------|-------------|--------------------------------|
| `com.ritense.case_.domain.definition.CaseDefinition` | `view`      | View a case definition         |
|                                                      | `view_list` | View case definitions in lists |
