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
