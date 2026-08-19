# 13.38.0

{% hint style="info" %}
**Release date 22-07-2026**
{% endhint %}

## New Features

* **Global search**

  A new global search feature allows users to search across all cases from a single search field. Users can find cases
  by any text in their document content without knowing which specific field contains the information. Results are
  filtered by the user's permissions.

* **OpenSearch for document search**

  Case list search and global document queries can now use OpenSearch as the search engine instead of PostgreSQL.
  OpenSearch provides faster full-text search and scales better for large document volumes. The feature is opt-in
  and PostgreSQL remains the source of truth. OpenSearch acts as a derived read model that syncs automatically.
  See [OpenSearch search](../../../running-valtimo/application-configuration/opensearch.md) for setup instructions.

## Enhancements

* **Faster case lists and searches**

  Case lists and document searches now load only the page of cases being shown, instead of fetching all matching
  cases at once.

* **Case start menu updates automatically when process availability changes**

  The start menu on the case detail page now keeps its list of startable supporting processes in sync
  automatically as the case progresses. Previously a supporting process that became (un)available due to
  permission (PBAC) changes only appeared or disappeared after a manual page refresh. The menu now re-fetches
  the startable items in response to case updates, so it always reflects the current visibility.

## Bugfixes

* **Tag columns in task lists now display their content correctly**

  A task list column configured with the *Tags* view type now displays its tag content correctly. Previously the
  tag content was not shown properly for tag-type columns in task lists.

* **Version validation error no longer persists in the create case definition modal**

  After entering an invalid version in the *Create case definition* modal, the validation error stayed
  visible when the modal was closed without saving and reopened. The version field and its error are now reset
  along with the rest of the form.

* **Long case definition descriptions no longer fail to save**

  The description in the *Create case definition* modal is now limited to 256 characters. Previously a longer description caused the save to fail with a server error.
  The character limit is also shown in the field's tooltip.

* **Documenten-api-file uploader loses uploaded file on redraw**

  Fixed an issue where a `documenten-api-file` uploader would lose its uploaded file when another
  uploader in the same form triggered a data change. This occurred when the affected uploader had
  `redrawOn: "data"` configured — a setting required for programmatically updating metadata fields
  such as the filename via `calculateValue`. On redraw, the Angular custom element was recreated
  with an empty value and the stored file references were never restored, causing the uploaded file
  to disappear from the UI.

* **`case:` value resolver now correctly resolves to case document inside building blocks**

  The `case:` value resolver now always resolves to the parent case document, even when used inside
  a building block. Previously, it incorrectly resolved to the building block's own document. This
  allows building block forms to read case metadata like `case:assigneeFullName` or `case:internalStatus`.
  Writing `case:` values from within a building block is not supported and will throw an error.
  
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

* **The case version management page is now labelled correctly**

  The page for creating and finalizing draft versions of a case definition is now titled *Versiebeheer* (Dutch) and
  *Version management* (English), matching the rest of that screen. Previously it was labelled *Implementatie* /
  *Deployment*, which did not reflect what the page actually does.

* ZGW document actions such as **view** and **modify** could be incorrectly disabled for documents uploaded from a
  building block process.
