# 13.42.0

{% hint style="info" %}
**Release date 19-08-2026**
{% endhint %}

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

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
