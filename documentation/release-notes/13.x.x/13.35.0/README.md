# 13.35.0

{% hint style="info" %}
**Release date 01-07-2026**
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

* **Catalogi API plugin action: Get Informatieobjecttype**

  A new plugin action `get-informatieobjecttype` has been added to the Catalogi API plugin. This action retrieves an
  informatie object type URL from the Catalogi API and stores it in a process variable.

  This is useful when you need to dynamically resolve an informatieobjecttype URL during process execution.

* **Process definition validation**

  - The process definition modeler now validates BPMN models before deployment. Click the new **Validate** button in the 
toolbar to check for issues, or validation runs automatically when deploying. The modeler highlights problematic
elements and displays an error panel. Clicking an error navigates to the element. Validation checks include:
    - Structural integrity: start/end events, flow connections, reachability
    - Task implementation: service tasks, user tasks, call activities need process links or native BPMN implementation
    - Expression syntax: validates JUEL expressions
    - Event configuration: message, timer, and signal events have required references
    - Gateway conditions: exclusive gateway outgoing flows have conditions (except default flow)
  
    Errors block deployment. Warnings allow deployment with confirmation.

  - A new **Draft** toggle in the modeler toolbar marks a process definition as draft. This replaces the **Executable** toggle that was hidden inside the modeler.
    Most validation is skipped for draft process definitions. This makes it easier to save work in progress definitions. Additionally, draft processes require an additional confirmation before running them (to start a new case, and when starting them for a running case).
    
* **Task properties in value paths**

  Task properties (`task:createTime`, `task:name`, `task:assignee`, `task:dueDate`, `task:assignedTeamTitle`) can now be
  selected anywhere a value path is configured.

## Enhancements

* **DMN decision table editing is now a standard feature**

  Editing decision tables in the UI is no longer experimental. The DMN editor is now used consistently for case,
  building block, and standalone decision tables, without a feature toggle.

* **Task list columns: path picker**

  The path field in the task list column modal is now a searchable dropdown instead of a free-text input.

* **Default sidebar state**

  It is now possible to configure the default state for the sidebar (collapsed or not) application wide via the settings
  page. User specific settings overwrite this.

## Deprecated

* The `experimentalDmnEditing` feature toggle has been removed from the admin settings UI and no longer has any
  effect — DMN editing is always enabled. The option is still accepted in configuration for backward compatibility,
  but it is ignored and will be removed in a future major release.

## Bugfixes

* **Sortable controls hidden for non-sortable paths**

  In the case and task list column editors, the **Sortable** checkbox and **Default sort** dropdown are now hidden when
  the configured path does not support sorting.

* **Standalone decision tables list no longer includes case or building block tables**

  The standalone **Decision tables** overview listed every decision table deployed in the engine, including those
  belonging to a case definition or building block. It now shows only standalone decision tables — those not linked to a
  case or building block definition.
