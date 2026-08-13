# Form flows

The Form flows tab lets you configure multi-step form sequences for complex data collection
workflows.

A form flow guides a user through a sequence of forms, like a wizard. Use it to break a single
task into several screens, to branch based on user input (for example, showing different
follow-up forms for approved and denied requests), and to run actions when a step opens,
completes, or the user goes back. A form flow is normally linked to a BPMN user task via a
[process link](processes.md).

Each form flow definition is configured as JSON against a schema, edited directly in a
code editor with autocomplete and validation, rather than through a form-based UI.

---

## Configuring form flows

{% stepper %}
{% step %}
Expand **Admin** in the left sidebar
{% endstep %}
{% step %}
Click **Cases** under the Configuration section
{% endstep %}
{% step %}
Click a case definition to open it
{% endstep %}
{% step %}
Click the **Form Flows** tab

<figure><img src="../../assets/configuration-guides/cases/form-flows/01-form-flows-tab-empty.png" alt="Form Flows tab showing the empty state"><figcaption>The Form Flows tab lists all form flow definitions configured for the case.</figcaption></figure>
{% endstep %}
{% endstepper %}

### Adding a form flow

{% stepper %}
{% step %}
Click **Create new form flow**
{% endstep %}
{% step %}
Enter a unique **Key** for the form flow

<figure><img src="../../assets/configuration-guides/cases/form-flows/02-add-form-flow-modal-filled.png" alt="Create new form flow modal with the key field filled in"><figcaption>The key identifies the form flow definition and is used to link it from a process.</figcaption></figure>
{% endstep %}
{% step %}
Click **Create**

You're taken to the form flow editor, which opens with a minimal default definition: a single
`start-step` and an empty `steps` array.

<figure><img src="../../assets/configuration-guides/cases/form-flows/03-editor-default-stub.png" alt="Form flow editor showing the default JSON stub"><figcaption>A newly created form flow starts with an empty steps array.</figcaption></figure>
{% endstep %}
{% endstepper %}

### Editing steps

Add and configure steps directly in the JSON editor. The editor validates your changes against
the form flow schema as you type and offers autocomplete for property names and values.

<figure><img src="../../assets/configuration-guides/cases/form-flows/04-editor-with-steps.png" alt="Form flow editor with multiple steps, a conditional transition, and an onComplete action"><figcaption>A form flow with a personal-details step that branches to one of two follow-up steps depending on the submitted age, and completes the surrounding task once finished.</figcaption></figure>

Click **Save** once the JSON is valid (the button is disabled otherwise). Use the overflow menu
(⋮) to **Export** the definition as a JSON file or **Delete** the form flow.

<figure><img src="../../assets/configuration-guides/cases/form-flows/05-editor-overflow-menu.png" alt="Editor overflow menu with Export and Delete options"><figcaption>Export downloads the form flow definition as a JSON file; Delete removes it.</figcaption></figure>

#### Form flow definition fields

| Field | Description |
|-------|-------------|
| `key` | Identifier of the form flow definition. Overwritten with the key from the URL when you save, so it doesn't need to be edited manually. |
| `startStep` | The step shown first when the form flow starts. Must match the `key` of one of the entries in `steps`. |
| `steps` | All steps in the form flow. At least one step is required, and step keys must be unique. |

#### Step fields

| Field | Description |
|-------|-------------|
| `key` | Identifier of the step, referenced from `startStep` and from `nextSteps`. |
| `title` | Optional. Label shown in the breadcrumb trail at the top of the form flow (when breadcrumbs are enabled). Falls back to a translation key if left empty. |
| `type` | What is rendered for the step — see [step types](#step-types) below. |
| `nextSteps` | Where the user can go after completing the step. Entries are evaluated in order; the first one whose `condition` is true is taken. At most one entry may omit its condition — that one is the default. If no entry matches, the form flow ends. |
| `onOpen` | Actions run when the user opens the step. |
| `onBack` | Actions run when the user navigates back from the step. |
| `onComplete` | Actions run when the user completes the step (submits the form). |

`onOpen`, `onBack`, and `onComplete` are each an array of [SpEL](https://docs.spring.io/spring-framework/reference/core/expressions.html)
expressions wrapped in `${...}`, evaluated in order. Common examples:

```json
"onComplete": [
    "${valtimoFormFlow.completeTask(additionalProperties, step.submissionData)}",
    "${valtimoFormFlow.startCase(instance.id, {'doc:/target':'/source'})}",
    "${valtimoFormFlow.startSupportingProcess(instance.id, {'doc:/target':'/source'})}"
]
```

#### Step types

| `type.name` | `type.properties` | Description |
|-------------|--------------------|--------------|
| `form` | `{ "definition": "<form key>" }` | Renders a Form.io form. `definition` must match the key of a form defined for the case (see [Forms](forms.md)). |
| `custom-component` | `{ "componentId": "<component id>" }` | Renders a custom Angular component instead of a form, identified by `componentId` as registered in the frontend. |

#### Next step fields

| Field | Description |
|-------|-------------|
| `step` | The `key` of the step to transition to. Must match one of the entries in `steps`. |
| `condition` | Optional. A SpEL expression wrapped in `${...}` evaluated against the current step's submission data, e.g. `${step.submissionData.personalDetails.age >= 21}`. Omit to make this entry the default transition. |

### Managing existing form flows

Form flows already created for the case appear in the list on the Form Flows tab.

<figure><img src="../../assets/configuration-guides/cases/form-flows/06-form-flows-tab-list.png" alt="Form Flows tab showing a list with one form flow"><figcaption>Existing form flows are listed with their key, version, and read-only status.</figcaption></figure>

Use the overflow menu on a row to **Edit** (opens the editor) or **Delete** the form flow.

<figure><img src="../../assets/configuration-guides/cases/form-flows/07-row-overflow-menu.png" alt="Row overflow menu with Edit and Delete options"><figcaption>Edit and Delete options for a form flow in the list.</figcaption></figure>

Deleting a form flow requires confirmation.

<figure><img src="../../assets/configuration-guides/cases/form-flows/08-delete-confirmation-modal.png" alt="Delete confirmation dialog for a form flow"><figcaption>Confirm deletion of a form flow.</figcaption></figure>

