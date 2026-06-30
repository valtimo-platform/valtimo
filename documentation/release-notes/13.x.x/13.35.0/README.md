# 13.35.0

{% hint style="info" %}
**Release date 01-07-2026**
{% endhint %}

## New Features

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

* **Image widget**

  A new image widget can be added to a case detail tab to display image files that are stored on the case. The
  widget resolves a value resolver path (for example `doc:/uploadedFiles`) to one or more uploaded file resources
  and renders the ones that are browser-renderable images (`png`, `jpg`, `jpeg`, `gif`, `webp`, `avif`, `svg`,
  `bmp`, `ico`). By default the images are shown in a grid, but a **Display as carousel** option presents them one
  at a time with navigation dots and previous/next arrows. See
  [Widgets](../../../features/case/case-detail/tabs/widgets.md) for the configuration details.

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
