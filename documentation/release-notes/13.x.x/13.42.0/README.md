# 13.42.0

{% hint style="info" %}
**Release date 19-08-2026**
{% endhint %}

## New Features

* **Look up the active process definition keys for an entire case**

  `ProcessDocumentsService` now exposes `activeProcessDefinitionKeysForCase`, which returns the process
  definition keys of every active process instance in a case, including those of sibling documents such as
  building-block instances. This makes it possible to find out which processes are currently running for a
  case without having to query each linked document separately.

## Enhancements

* **Dashboard case widgets only count cases you are allowed to see**

  Widgets that show case counts used to include every case in the system. They now count only the cases you may
  view, so the numbers match what you see in the case list.

## Bugfixes

* **Pages no longer break when a user has been deleted**

  Valtimo shows who created or was assigned to something by looking up that person's name. When that user had
  since been deleted, the lookup failed and took the whole page down with it: the tab overview of a case type,
  for example, could no longer be opened at all. A name that can no longer be found is now simply left out
  instead of causing an error, and tasks are no longer automatically assigned to a user that no longer exists.

* **A form flow can now be used as the start form of a building block**

  Starting a building block from the actions of a case now opens its form flow start form, and submitting that
  form starts the building block version that is linked to the case. Previously the start form did not open at
  all and the building block could not be started this way, while the same setup with a regular form did work.

* **Deleting a process linked to a case now cleans up properly**

  When a process that was linked to a case definition was deleted, the link remained in the database.
  This could cause errors when viewing or exporting the case definition. Existing orphaned
  links from earlier versions are automatically cleaned up during upgrade.

* **Form flow steps with a colon in their expressions work again after import**

  Importing a case no longer breaks form flow steps whose start or complete expression contains a colon, such as one
  that saves submission data to a document or process variable. These steps stopped working after import because part
  of the expression was cut off.

* **Object permissions are checked before the object is retrieved**

  A user without permission to view objects is now refused before anything is requested from the Objecten API.
  Previously the object was retrieved first, so the answer of the Objecten API could tell such a user whether an
  object exists.

* **A dashboard widget with the bar chart display type is no longer empty**

  A dashboard widget that is configured with case counts and the bar chart display type showed an empty
  widget, while the same counts were shown correctly with the donut and meter display types. The bar
  chart is now rendered.

* **A form flow of a user task now loads completely when another user task is opened**

  When a process has multiple user tasks that are linked to a form flow, opening the next user task
  showed an empty or half rendered form until the tab was switched or the page was refreshed. The
  form flow now reloads its step whenever another form flow instance is opened.

* **Quickly opening the next user task no longer empties the task modal**

  When a user completed a task and opened the next one within a fraction of a second, the task modal
  could lose its content shortly after opening: the delayed cleanup of the previous task cleared the
  modal after the next task was already shown. That cleanup is now skipped when another task has been
  opened in the meantime.

* **A form flow step without a translation no longer shows a raw translation key**

  The step indicator above a form flow form showed the raw translation key (for example
  `formFlow.step.step1.title`) when no translation was defined for a step. It now falls back to the
  step key from the form flow definition.

* **Breadcrumbs of a DMN decision table no longer stay behind on other screens**

  After opening a decision table of a case and then navigating to another screen through the menu, the
  breadcrumbs, page title and page header buttons of the decision table could stay visible on that screen
  until the page was reloaded. The decision table screen now always cleans up its breadcrumbs and title,
  even when the DMN editor fails to shut down.

## Security

* **Permission checks only accept known resource types**

  When Valtimo was asked whether a user may perform an action, the resource type in that question was taken at
  face value, which allowed any signed-in user to make the server load arbitrary internal parts of the
  application. Only the resource types that can be selected under **Access control** are accepted now, and
  anything else is answered as "not permitted", so normal use is unaffected.
* Addressed several reported high-severity front-end security alerts. The `js-yaml`, `fast-uri`, `ip-address`,
  `postcss` and `brace-expansion` dependencies were updated to fixed versions. The remaining alerts cannot be
  resolved without a major upgrade: the Swagger UI `immutable` fix requires Node 22, and the Angular alerts require the
  next major Angular version. Both remain tracked.
