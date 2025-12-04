# Backend libraries 10.8.0

## New Features

The following features were added:

* **Added properties to portaaltaak**

  When a portaaltaak is created through the portaaltaak plugin, the 'verloopdatum' and 'zaak' properties are included in the object. 
  - The 'verloopdatum' property is calculated based on the configured 'verloopDurationInDays'
  - The 'zaak' property includes the full URL to the Zaak, if present

* **Error when uploading Form.io forms**

  The uploading of Form.io forms in the form admin menu has been fixed.

* **Faster loading of task assignees**

  The list of users that can be assigned to a task now load significantly faster.

## Bugfixes

The following bugs were fixed:

* **Task candidate users list was incomplete**

  The candidate-user list of a user task was incomplete for tasks with multiple candidate groups. In this case, the candidate-user list would only contain users based on the first candidate group.

* **Fix DMN upload**

  The `/v1/process/definition/deployment` endpoint only accepted uploaded files with the .bpmn extension, causing DMN uploads to fail.

## Breaking changes

No breaking changes.

## Deprecations

No deprecations.

## Known issues

No known issues.
