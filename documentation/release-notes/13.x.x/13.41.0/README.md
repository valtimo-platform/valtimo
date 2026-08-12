# 13.41.0

{% hint style="info" %}
**Release date 12-08-2026**
{% endhint %}

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

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

* **Breadcrumbs of a DMN decision table no longer stay behind on other screens**

  After opening a decision table of a case and then navigating to another screen through the menu, the
  breadcrumbs, page title and page header buttons of the decision table could stay visible on that screen
  until the page was reloaded. The decision table screen now always cleans up its breadcrumbs and title,
  even when the DMN editor fails to shut down.

* **Start form of a building block now opens in the panel**

  Starting a building block from the 'Start' menu of a case did nothing when the start form of its
  main process is configured to be shown in a panel. The panel now opens right away. Previously it
  only appeared after first opening the start form of a regular process in the panel.
