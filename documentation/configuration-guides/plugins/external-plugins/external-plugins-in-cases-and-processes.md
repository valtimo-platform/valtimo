# External plugins in cases and processes

Once configured, an external plugin is used in the same places as embedded functionality. This
page lists each surface and where to configure it.

---

## Process actions

A plugin action runs when a process reaches a service task. Actions are bound in the process
modeler through a **process link**, exactly like embedded plugin actions:

{% stepper %}
{% step %}
Open the process in the modeler (**Admin** > **Cases** > case definition > **Processes**)
{% endstep %}
{% step %}
Select the service task and add a **Plugins & Apps** process link
{% endstep %}
{% step %}
Choose the external plugin configuration — external entries show the plugin name with its
version, so it is always clear which version the process binds to
{% endstep %}
{% step %}
Choose the action, fill in its input, and optionally map the action's result
{% endstep %}
{% endstepper %}

Action inputs accept value-resolver expressions (`doc:`, `pv:`, `case:`), which are resolved when
the action runs. The optional **output mapping** writes parts of the action's result back to the
case document or to process variables — no plugin-specific glue code needed.

{% hint style="info" %}
Whether the action's input is a form depends on the plugin. A plugin that provides one shows its
own fields here; a plugin that does not shows a single JSON text area, and the inputs must be
entered as a JSON object. Ask the plugin's supplier for the property names and an example — the
same situation as [a plugin without a settings form](configure-a-plugin.md#plugins-without-a-settings-form).
{% endhint %}

An action failure (including an unreachable integration) surfaces as a process error on the
service task, like any other failing action.

{% hint style="info" %}
Inside building blocks, an external action is linked by plugin and version; the concrete
configuration is chosen per case definition that uses the block — the same pattern as embedded
plugins.
{% endhint %}

---

## Task forms

A plugin can render the form for a user task. On a user task, the **Plugins & Apps** process link
lists the plugin's forms; the completing user's input is submitted through Valtimo, which applies the
values (for example `doc:` fields and process variables) and completes the task — the standard
task-completion pipeline. Depending on the plugin, the form may also validate or transform the
submission before the task completes, with validation errors shown on the form.

---

## Case tabs

A plugin screen can be a tab on the case detail page. Configure it under **Admin** > **Cases** >
case definition > **Case details** > **Tabs** by creating a tab of type **External plugin** and
selecting the plugin configuration (and, when the plugin offers more than one tab screen, which
one). See [Tabs](../../cases/case-details/tabs.md) for the general tab configuration flow.

The type only appears when at least one activated external plugin offers a case tab screen.

---

## Case widgets

A plugin screen can also be a card on a widgets tab, next to the built-in widgets. In the widget
tab editor, add a widget of type **External plugin** and select the configuration (and which
widget screen, when the plugin offers several). The standard width, density, appearance, and
display-condition options apply.

---

## Menu pages

A plugin can add a whole page to the navigation menu, configured in the menu management. The
page's title and icon come from the plugin.

---

## Import and export

Case definition export and import treat external plugin references like embedded ones: the
import wizard shows every referenced plugin configuration and lets you map each to a
configuration in the target environment. An unmapped reference imports as *dangling* — the case
definition works except for that binding — and is repaired later from the case definition's
issues panel.

---

## Access control

What end users see of a plugin is governed by the standard access control rules, and everything
a plugin screen does on behalf of a user is additionally limited to what that user is allowed to
see and do. For case tabs and widgets the standard resources apply — see
[Tabs](../../cases/case-details/tabs.md#access-control):

| Resource type | Action | Effect |
|---------------|--------|--------|
| `com.ritense.case.domain.CaseTab` | `view` | Allows viewing a specific tab — including external plugin tabs — on the case detail page |
| `com.ritense.case_.domain.tab.CaseWidgetTabWidget` | `view` | Allows viewing a specific widget — including external plugin widgets — on a widgets tab |
