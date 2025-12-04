# 13.4.0

{% hint style="info" %}
**Release date 21-10-25**
{% endhint %}

## New Features

* The Catalogi API plugin has been expanded with support for two additional methods
  * Get Resultaattypen. Retrieves a list of resultaattypen and saves these in a process variable.
  * Get statustypen. Retrieves a list of statustypen and saves these in a process variable.
* Quick search items have been added to the case list. Now, when filling in search values, they can be saved under a quick search item. When clicking on the item, the search will automatically be filled in and executed.
* Case list columns can now be hidden to make seeing relevant information easier. When having configured case list columns, it is now possible to select/deselect which columns are visible via a dropdown menu in the list toolbar.
* Allow grouping of widgets. A new widget type called Divider has been introduced, enabling grouping of widgets within a case. The Divider widget type introduces the ability to organize widgets into multiple grid sections. Optionally, it can display a title, which acts as a header for that widget group.

<figure><img src="../../../.gitbook/assets/image (20).png" alt=""><figcaption></figcaption></figure>

* Improved performance of retrieving permissions for a user when having to do a permission check.

* Case Header Widget  
  A new Case Header Widget has been introduced, allowing important case information to be displayed prominently at the 
  top of the case detail page. This section remains visible at all times, regardless of which tab is selected, ensuring 
  key details are always accessible. [Find the full documentation here](/features/case/case-detail/tabs/header-widget.md)

## Bugfixes

* When using Dutch translations, a widget without fields would show German translations rather than Dutch.
* The correct form is now linked to the user task when creating a new case definition draft.
* Fixed an issue where the menu under the Start process button in the Documents tab of the case detail was smaller than in the other tabs. The menu size is now consistent across all tabs.
* When an external start form is configured, it now correctly shows up as an option when creating a new case.
* Both verzoek plugin configurations that were migrated from version 12.x and newly created configurations now work correctly.
* Fixed a bug where filters and buttons from the analysis page could appear on the dossier page after quickly switching between the two pages.
* Quick search access control now has parity with other access control checks.
