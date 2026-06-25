# 13.35.0

{% hint style="info" %}
**Release date 01-07-2026**
{% endhint %}

## New Features

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

* **Task list columns: path picker**

  The path field in the task list column modal is now a searchable dropdown instead of a free-text input.

* **Default sidebar state**

  It is now possible to configure the default state for the sidebar (collapsed or not) application wide via the settings
  page. User specific settings overwrite this.

## Bugfixes

* **Sortable controls hidden for non-sortable paths**

  In the case and task list column editors, the **Sortable** checkbox and **Default sort** dropdown are now hidden when
  the configured path does not support sorting.
