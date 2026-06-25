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

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* New bugfix.
