# 12.49.0

## New Features

* **Delete a document from a process**

  The Documenten API plugin has a new **Delete informatie object** action, so a process can delete
  a document straight from a service task by giving its URL. The same checks that already run when
  a document is deleted elsewhere in the application also run for this action.

## Enhancements

* **More reliable JavaScript results**

  Values returned by JavaScript in process scripts and decision tables now stay usable after the script has
  finished. Lists, sets and key-value maps returned by a script keep their contents; previously some of them came
  back empty.

  Lists and maps that a script fills with its own objects now also stay readable after the script has finished.
  They come back as copies made of plain data. Very large results stop the script with a clear error.

  **Hint:** objects a script puts into existing data without returning it are not converted. Return the value or
  store it as a process variable.

  **Behaviour change:** a script must return plain data, such as text, numbers, dates, lists or objects. Scripts
  that return something else, for example a function or a promise, now stop with a clear error message instead of
  silently returning an unusable value. Check scripts that return such values and change them to return plain data.

## Bugfixes

* Running JavaScript in processes and decision tables no longer makes the application use more and more memory
  over time. Scripts also run faster.

## Security

* **JavaScript can no longer get around its allowed classes**

  A JavaScript script task or decision table expression can no longer get around the list of classes it is allowed to
  use, and so can no longer reach the rest of the application or the server it runs on. This follows up on the
  allowed-class restrictions for JavaScript introduced in 12.46.0.

* **Variables can no longer change the JavaScript restrictions**

  A process or decision variable can no longer influence the restrictions that apply to JavaScript, either during its
  own run or during later ones.

* **`engine` and `context` objects no longer available in scripts**

  Scripts can no longer use the `engine` and `context` objects that the script engine previously made available. These
  were never part of the supported scripting interface. A script that uses one of them now fails and must be rewritten
  using process variables or `execution`.

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
