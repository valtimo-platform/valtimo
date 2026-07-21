# 13.38.0

{% hint style="info" %}
**Release date 22-07-2026**
{% endhint %}

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **Zaaktype dropdown now shows the begin and end date**

  The 'Gekoppeld zaak type' dropdown in the case type link configuration now shows the start and end
  date of each zaaktype between parentheses, next to its description. This makes it possible to tell
  apart different versions of zaaktypes that share the same description, preventing configuration
  mistakes.

* **Option to keep the form.io token out of localStorage**

  A new `disableFormioTokenInLocalStorage` feature toggle keeps the form.io token in memory only
  instead of persisting it to localStorage. It is disabled by default.

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