# 13.41.0

{% hint style="info" %}
**Release date 12-08-2026**
{% endhint %}

## New Features

* **Visual form flow editor**

  Form flows can now be built in a visual editor instead of writing JSON by hand. The editor opens on a new
  **Editor** tab when a form flow is opened in case management or building block management; the existing JSON
  editor remains available on a separate **JSON editor** tab, and both work on the same definition.

  The visual editor shows the steps of the flow in a sidebar and the configuration of the selected step next to
  it. Per step, the key, title and step type can be set, and the type-specific configuration is offered as a
  choice: the **Form** dropdown lists the forms of the surrounding case definition or building block, and the
  **Component ID** dropdown lists the custom components registered by the implementation (the
  `custom-component` type is unavailable when none are registered). Any step can be marked as the start step,
  and renaming a step key automatically updates the start step and every transition that referenced it.

  Transitions to next steps are configured per step, including their SpEL conditions and evaluation order.
  Actions that run when a step opens, completes, or when the user navigates back can be added from a menu that
  lists the registered form flow functions — such as `valtimoFormFlow.completeTask` — with their parameters.
  Inline help explains how conditions and actions work, and a help dialog documents exactly which data is
  available in `additionalProperties`, based on what the application provides.

  The editor validates the definition while editing (duplicate step keys, missing start step, transitions to
  unknown steps, at most one default transition) and warns when leaving the page with unsaved changes. See the
  [form flow documentation](../../../features/case/form-flow.md#creating-a-form-flow-definition) for details.

## Bugfixes

* **Changing the form flow of an existing form flow process link is now saved**

  When editing an existing form flow process link and selecting a different form flow definition, the change
  was silently ignored on save: the process link kept its previous form flow. Changes to the display type and
  size were saved correctly, which made this easy to miss. Selecting a different form flow definition is now
  saved as expected.
