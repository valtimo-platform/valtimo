# 13.41.0

{% hint style="info" %}
**Release date 12-08-2026**
{% endhint %}

## New Features

* **Send a message to a case and its building blocks**

  Processes can now send a message to a whole case: the case's own processes and all of its building blocks receive
  it. This makes it possible to let a building block react to something that happens elsewhere in the case, and to let
  building blocks signal each other. Messages can also be sent to another case, for example a related one. The new
  methods sit on the existing `correlationService`, next to the other correlation methods — see
  [correlating messages](../../../features/process/correlation-service.md#correlating-to-a-whole-case-including-its-building-blocks).

* **Start a building block with a message**

  A building block can now be started by sending a message to the case, instead of only from a call activity or from
  the case's **Start** menu. See
  [Start a building block by message](../../../features/building-blocks/README.md#start-a-building-block-by-message).


## Enhancements

* **Searchable dropdowns on the process migration screen**

  The *Source Definition*, *Source Version*, *Target Definition*, *Target Version* and *Choose Target*
  dropdowns on the *Process migration* screen are now combo boxes, so typing in the field filters the
  available entries. This makes it easier to find a process in an environment with many process
  definitions. Selecting a source definition now also preselects the same definition as target, and
  clearing the source definition clears the source version, target definition and target version as
  well, so no stale selection is left behind.

* **Searchable process dropdown on the Progress tab**

  The process dropdown on the *Progress* tab of a case is now a combo box. Typing in the field filters
  the processes linked to the case, instead of having to scroll through the full list.

## Bugfixes

* **Actions now respect the linked building block version**

  Starting a building block from the actions of a case now always runs the version of that building block
  that is linked to the case. Previously a newer version of the same building block took over: after
  creating a new version and changing its process, starting the action still ran the newer version, which
  led to an error when that version wrote to fields the linked version does not have. Changes to other
  versions of a building block no longer affect the version that is linked.

  A process that belongs to a building block can now only be started for a specific version. Starting one
  by process definition key alone - for example from a custom plugin or a `startProcessByProcessDefinitionKey`
  expression outside of a building block - now reports a clear error instead of silently running whichever
  version happened to be deployed last.

* **A divider widget without a title no longer shows a dash**

  A divider widget that is configured without a title now stays empty, both in the widget list on the
  widget management page and on the widget tab of a case. Previously a `-` was shown in both places as a
  placeholder for the missing title. In addition, saving a divider without a title on an IKO view no longer
  fails: the back end required a non-blank title for every widget, while a divider does not need one.

* **A divider widget can be duplicated again**

  Fixed an issue where duplicating a divider opened the duplication dialog with an empty, invalid key that 
  could not be edited, leaving the Duplicate button disabled. The dialog now pre-populates the divider key 
  with a unique default value and allows it to be edited before duplicating.
  
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

* **Start form of a building block now opens in the panel**

  Starting a building block from the 'Start' menu of a case did nothing when the start form of its
  main process is configured to be shown in a panel. The panel now opens right away. Previously it
  only appeared after first opening the start form of a regular process in the panel.

* **Exporting case definitions**

  Case definitions that had a process definition removed via the database were unable to be exported.
