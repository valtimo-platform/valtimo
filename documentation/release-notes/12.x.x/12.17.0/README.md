# 12.17.0

{% hint style="info" %}
### Release date 16-09-2025
{% endhint %}

## New features

* Improved performance of certain access control checks.
* Added multiple action to access control permissions. It is now possible to add a list of actions to each access control permission, making it easier to set up the configuration and keep conditions the same between different permissions.

_Before_:

```
        {
            "resourceType": "com.ritense.document.domain.impl.JsonSchemaDocument",
            "action": "view_list",
            "roleKey": "ROLE_USER",
            "conditions": [
                {
                    "type": "field",
                    "field": "assigneeId",
                    "operator": "==",
                    "value": "${currentUserId}"
                }
            ]
        },
        {
            "resourceType": "com.ritense.document.domain.impl.JsonSchemaDocument",
            "action": "view",
            "roleKey": "ROLE_USER",
            "conditions": [
                {
                    "type": "field",
                    "field": "assigneeId",
                    "operator": "==",
                    "value": "${currentUserId}"
                }
            ]
        },
```

_After_:

```
        {
            "resourceType": "com.ritense.document.domain.impl.JsonSchemaDocument",
            "actions": [
                "view_list",
                "view",
            ],
            "roleKey": "ROLE_USER",
            "conditions": [
                {
                    "type": "field",
                    "field": "assigneeId",
                    "operator": "==",
                    "value": "${currentUserId}"
                }
            ]
        },
```

* Added a way of exporting case information. A button is available on the case list screen, next to the create button that allows a user to download all cases that match the current search criteria. In the list column settings columns can be set to exportable. In order for the button to appear, both the new `export` permission on `com.ritense.document.domain.impl.JsonSchemaDocument` should be set, and at least 1 exportable column needs to be configured for that case type.

## Bugfixes

* Prevent errors on the case details page by no longer break when related process instances have been deleted (for instance by the history TTL of Camunda).
* Fixed an error where the whitelist for the BPMN ScriptTask (`valtimo.camunda.scripting.allowedClasses`) was not properly loaded into Valtimo.
