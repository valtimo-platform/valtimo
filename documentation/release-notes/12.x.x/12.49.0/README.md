# 12.49.0

## New Features

* **Delete a document from a process**

  The Documenten API plugin has a new **Delete informatie object** action, so a process can delete
  a document straight from a service task by giving its URL. The same checks that already run when
  a document is deleted elsewhere in the application also run for this action.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* **Add configurable read timeout to Apache REST client customizer**

  A call to a slow Zaken or Objecten API now waits up to 180 seconds for an answer instead of giving up after a few seconds. Giving up early could leave a zaak behind without a case around it.

## Security

* **Process instance search and count restricted to administrators**

  The process instance search and count endpoints no longer let any logged-in user list the process instances of all
  cases or search their process variables. They are now only available to administrators. The search endpoints and the
  count by process definition name will be removed in a future version.

* **Adding a comment to a process instance restricted to administrators**

  Adding a comment to a process instance is now only available to administrators, and will be removed in a future
  version.

* **Deploying a short timer version of a process restricted to administrators**

  Deploying a version of a process definition with shortened timers is now only available to administrators, and will
  be removed in a future version.

* **Process instance details restricted to administrators**

  The endpoints that return the details, history, operation log, active task, diagram, activities, comments and
  variables of a process instance are now only available to administrators. The process diagram in the case
  **Progress** tab now uses a new endpoint that requires `view` permission on the case, so it keeps working for users who
  can see the case. The process timer endpoints of the **Progress** tab now also require `view` permission on the case.

* **Stack traces no longer returned to every client**

  Error responses no longer include technical details such as stack traces for every client.
