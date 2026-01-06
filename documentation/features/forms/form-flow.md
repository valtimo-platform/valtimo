# Form flow

Form flow allows users to create a sequence of forms, similar to a flow chart or form wizard. A form flow definition contains the configuration for each step, what the subsequent steps are, and the conditions under which they can be reached. A form flow can be linked to a task, which consequently allows for more forms for the same task. Form flow supports forwards and backwards movement between steps without completing the task, reducing complexity in a BPMN model.

Form flow offers a way to configure a flow between different Form IO forms inside the same user task.

## Creating a form flow definition

A form flow definition is a JSON document that defines steps and which steps can be reached under what conditions when the current step is completed. Each step can have zero or more actions (e.g. retrieve external data) that trigger when the task is opened or completed. Depending on the type of step, the step can be handled in a different way. The way a form is handled can differ from a payment, for example.

For information on how to link a form flow definition to a task, see [here](broken-reference).

{% tabs %}
{% tab title="Via UI" %}

{% endtab %}

{% tab title="Via IDE" %}
To create form flow definition, the following steps are necessary:

* Create a form flow `.json` file under the following path: `*/resources/config/form-flow/`.
* Add each individual step to the form flow definition, e.g.:

```json
{
    "startStep": "personalDetailsStep",
    "steps": [
        {
            "key": "personalDetailsStep"
        },
        {
            "key": "loanApprovedStep"
        },
        {
            "key": "loanDeniedStep"
        },
        {
            "key": "summaryStep"
        }
    ]
}
```

* Add the next steps for each of the individual steps. This can be done through the `nextStep` property, which supports a single step, or `nextSteps`, which supports multiple next steps. Each step should correspond to the key of another step defined in this form flow.

```json
{
    "startStep": "personalDetailsStep",
    "steps": [
        {
            "key": "personalDetailsStep",
            "nextSteps": [
                {
                    "step": "loanApprovedStep"
                },
                {
                    "step": "loanDeniedStep"
                }
           ]
        },
        {
            "key": "loanApprovedStep",
            "nextStep": "summaryStep"
        },
        {
            "key": "loanDeniedStep",
            "nextStep": "summaryStep"
        },
        {
            "key": "summaryStep"
        }
    ]
}
```

* The `personalDetailsStep` is now followed by two other steps. This is only allowed when at least one of the two steps is conditional. The order of next step matters. The first `nextStep` with `condition` that is evaluated to `true` will be the next step. When all the conditions are evaluated to `false` the next step will be the default step; which is the step without condition. If no next step is found, the form flow will end. The expression inside the condition is further explained [here](broken-reference).

```json
{
    "startStep": "personalDetailsStep",
    "steps": [
        {
            "key": "personalDetailsStep",
            "nextSteps": [
                {
                    "step": "loanApprovedStep",
                    "condition": "${step.submissionData.personalDetails.age >= 21}"
                },
                {
                    "step": "loanDeniedStep"
                }
           ]
        },
        {
            "key": "loanApprovedStep",
            "nextStep": "summaryStep"
        },
        {
            "key": "loanDeniedStep",
            "nextStep": "summaryStep"
        },
        {
            "key": "summaryStep"
        }
    ]
}
```

*   Configure the step type. Currently, the only step type supported is `form`, which requires a `definition` property to be set. This refers to the key of the form. For more information on step types, see [here](broken-reference)

    Which properties are required to be set depends on the step type.

```json
{
    "startStep": "personalDetailsStep",
    "steps": [
        {
            "key": "personalDetailsStep",
            "type": {
                "name": "form",
                "properties": {
                    "definition": "personal-details-form"
                }
            },
            "nextSteps": [
                {
                    "step": "loanApprovedStep",
                    "condition": "${step.submissionData.personalDetails.age >= 21}"
                },
                {
                    "step": "loanDeniedStep"
                }
           ]
        },
        {
            "key": "loanApprovedStep",
            "type": {
                "name": "form",
                "properties":  {
                    "definition": "loan-approved-form"
                }
            },
            "nextStep": "summaryStep"
        },
        {
            "key": "loanDeniedStep",
            "type": {
                "name": "form",
                "properties":  {
                    "definition": "loan-denied-form"
                }
            },
            "nextStep": "summaryStep"
        },
        {
            "key": "summaryStep",
            "type": {
                "name": "form",
                "properties":  {
                    "definition": "summary-form"
                }
            }
        }
    ]
}
```

* Add triggers to steps where necessary (e.g. to store data externally). See below for more information.

### Expressions

Form flow supports Spring Expression Language (SpEL) expressions to allow for more complex actions when a step is opened or completed. Expressions can be recognized by the surrounding `${ }` characters. The following additional properties are supported for steps:

* `onBack`. Triggers the expressions when navigating to the previous step, e.g. to remove data from a document.
* `onOpen`. Triggers the expressions when the step is opened, e.g. to retrieve external data.
* `onComplete`. Triggers the expressions when the step is complete, e.g. to store the results in a document.

Each of these properties supports more than one expression, e.g. when a step is opened, external data from more than one source is retrieved. These expressions are evaluated in order.

Valtimo provides access to certain variables in the SpEL context, e.g. what the current step is. Which properties are available can be found [here](broken-reference)

```json
{
    "startStep": "personalDetailsStep",
    "steps": [
        {
            "key": "personalDetailsStep",
            "type": {
                "name": "form",
                "properties": {
                    "definition": "personal-details-form"
                }
            },
            "onOpen": ["${someService.retrieveData(additionalProperties)}"],
            "nextSteps": [
                {
                    "step": "loanApprovedStep",
                    "condition": "${step.submissionData.personalDetails.age >= 21}"
                },
                {
                    "step": "loanDeniedStep"
                }
            ]
        },
        {
            "key": "loanApprovedStep",
            "type": {
                "name": "form",
                "properties": {
                    "definition": "loan-approved-form"
                }
            },
            "onBack": ["${someService.removeData(additionalProperties)}"],
            "nextStep": "summaryStep"
        },
        {
            "key": "loanDeniedStep",
            "type": {
                "name": "form",
                "properties": {
                    "definition": "loan-denied-form"
                }
            },
            "nextStep": "summaryStep"
        },
        {
            "key": "summaryStep",
            "onComplete": ["${valtimoFormFlow.completeTask(additionalProperties, step.submissionData)}"],
            "type": {
                "name": "form",
                "properties": {
                    "definition": "summary-form"
                }
            }
        }
    ]
}
```

By default, SpEL allows access to every Spring bean from inside expressions. For security reasons, this has been changed to a whitelist instead. More information on how to whitelist Spring beans is available [here](forms/whitelist-spring-bean.md) and more information on SpEL can be found [here](https://docs.spring.io/spring-framework/docs/current/reference/html/core.html#expressions).
{% endtab %}
{% endtabs %}

## Step types

The following step types are supported by form flow:

### Form

The `form` step type is used to associate a step with a specific form. The following properties are supported:

```json
    ...
      "type": {
        "name": "form",
        "properties": {
          "definition": "String" //The ID of the form
        }
      }
    ...
```

### Custom component

The `custom-component` step type is used to associate a step with a custom-made front-end component. The following properties are supported:

```json
    ...
      "type": {
        "name": "custom-component",
        "properties": {
          "componentId": "String" //The key of the component in the front-end
        }
      }
    ...
```

More information on custom form flow components can be found [here](forms/create-custom-component.md).
