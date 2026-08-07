# 13.41.0

{% hint style="info" %}
**Release date 12-08-2026**
{% endhint %}

## New Features

* **Send a message to a case and its building blocks**

  Processes can now send a message to a whole case: the case's own processes and all of its building blocks receive
  it. This makes it possible to let a building block react to something that happens elsewhere in the case, and to let
  building blocks signal each other. Messages can also be sent to another case, for example a related one. See
  [Send a message to a case](../../../features/building-blocks/README.md#send-a-message-to-a-case).

* **Start a building block with a message**

  A building block can now be started by sending a message to the case, instead of only from a call activity or from
  the case's **Start** menu. See
  [Start a building block by message](../../../features/building-blocks/README.md#start-a-building-block-by-message).


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
  
* **Start form of a building block now opens in the panel**

  Starting a building block from the 'Start' menu of a case did nothing when the start form of its
  main process is configured to be shown in a panel. The panel now opens right away. Previously it
  only appeared after first opening the start form of a regular process in the panel.
