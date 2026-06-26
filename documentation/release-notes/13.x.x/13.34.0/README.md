# 13.34.0

{% hint style="info" %}
**Release date 24-06-2026**
{% endhint %}

## New Features

* **Create and edit DMN decision tables in the UI**

  Decision tables can now be created directly in GZAC. A **Create DMN table** button next to **Upload** opens a dialog
  where you enter a name and, optionally, one or more input columns. Each input column takes a process variable
  (required) and an optional label used as the column header — when the label is left blank the process variable name
  is used. The table is generated with those columns so it is functional immediately, and you continue building it in
  the DMN editor. Existing tables can also be renamed and have their input columns changed through the **Edit** action
  (in the list row overflow menu and the editor's top-right menu), and removed through the **Delete** action with a
  confirmation prompt. This applies to case, building block, and standalone decision tables. See
  [Decision tables](../../../features/case/decision-tables.md).

## Enhancements

* **DMN decision table editing is now a standard feature**

  Editing decision tables in the UI is no longer experimental. The DMN editor is now used consistently for case,
  building block, and standalone decision tables, without a feature toggle.

* **Start supporting process forms in the case detail panel**

  The process link configuration of a start event now offers a **Display type** option (Modal or Panel), defaulting to
  **Modal**. When a supporting process is started from the **Start** button with its start event configured as
  **Panel**, the start form opens in the case detail panel, the same way user task forms can. This requires the active
  tab to expose a panel. Otherwise the form opens in the modal as before. Form types that rely on view models or custom
  UI components always open in the modal.

* **Value resolver support for Documenten API plugin**

  In the Documenten API plugin, the *store temp document* action can now resolve the confidentiality level, language and status from a value resolver expression (e.g. `pv:confidentialityLevel` or `doc:/confidentialityLevel`)
  instead of only a option op a dropdown, selectable per field via an input-type toggle. This makes all parameters resolvable which is useful in Building blocks.

## Deprecated

* The `experimentalDmnEditing` feature toggle has been removed from the admin settings UI and no longer has any
  effect — DMN editing is always enabled. The option is still accepted in configuration for backward compatibility,
  but it is ignored and will be removed in a future major release.

## Bugfixes

* **Case definition could not be deleted when it contained a form flow**

  Deleting a case definition that had a form flow attached failed with an error. The only workaround was to delete the
  form flow definition first and then the case definition. Both can now be deleted in one step.

* **Form flows in draft case definitions could not be edited**

  Form flows in a draft case definition were incorrectly shown as read-only and can now be edited.

* **Uploading documents from a building block case**

  Fixed an issue where uploading a document from within a building block could fail to start the configured upload
  process.
