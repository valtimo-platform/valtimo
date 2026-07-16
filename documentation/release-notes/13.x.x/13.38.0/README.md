# 13.38.0

{% hint style="info" %}
**Release date 22-07-2026**
{% endhint %}

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* **Tag columns in task lists now display their content correctly**

  A task list column configured with the *Tags* view type now displays its tag content correctly. Previously the
  tag content was not shown properly for tag-type columns in task lists.

* **Lists no longer jump in size while loading**

  While a list is loading, its placeholder now stays a consistent, compact size instead of briefly expanding to a large
  number of rows before the data appears. This makes lists shown in dialogs and smaller areas feel more stable and
  smoother as they load.

* **Changing a widget tab's layout no longer hides the task panel**

  When you change the layout algorithm of a widget tab, the option to show the task panel now keeps its previous value.
  Previously, adjusting the layout turned the task panel off, so it unexpectedly disappeared from the case detail
  screen.

* **Fixed values can now be entered as building block input**

  When configuring a building block input in manual mode, a value you type in
  is now stored and used exactly as entered. Previously it was incorrectly turned into a document reference by
  prepending `doc:/`, so the fixed value could not be used.

* **Task forms keep their background on small screens**

  When you open a task form in a small or minimized browser window and scroll through a long form, the form now keeps
  its background all the way down. Previously the background could fall away while scrolling, leaving part of the form
  without a backdrop.
