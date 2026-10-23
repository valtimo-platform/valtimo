# 12.49.0

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* New bugfix.

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
