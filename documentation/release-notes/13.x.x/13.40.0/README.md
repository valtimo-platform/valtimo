# 13.40.0

{% hint style="info" %}
**Release date 05-08-2026**
{% endhint %}

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **Dashboard: task count widget improvements**

  The `task-count` dashboard widget data source has been improved:
  * An optional filter on the case definition type. When set, both the count and the total it is
    compared against are limited to tasks belonging to cases of that case definition. This filter
    requires the `process-document` module.
  * `and`/`or` condition groups, so multiple task types (or any other conditions) can be combined
    in a single widget (for example `assignee != null AND (name == A OR name == B)`).
  * The `in` operator, as a compact alternative to an `or` group of `==` conditions.

  The widget configuration screen in the admin UI has been extended with a case type dropdown and
  an editor for condition groups. Every group has an `AND`/`OR` selector and can be nested to any
  depth, so the full condition tree can be configured from the UI. Individual conditions that the
  editor cannot represent (`in` conditions with an array value, or operators outside the dropdown)
  are shown as a notification and preserved in their group when the widget is saved. Existing
  configurations keep working without migration: the `queryConditions` property and the
  `queryPath`/`queryOperator`/`queryValue` aliases remain valid.

* **Zaaktype dropdown now shows the begin and end date**

  The 'Gekoppeld zaak type' dropdown in the case type link configuration now shows the start and end
  date of each zaaktype between parentheses, next to its description. This makes it possible to tell
  apart different versions of zaaktypes that share the same description, preventing configuration
  mistakes.

* **Option to keep the form.io token out of localStorage**

  A new `disableFormioTokenInLocalStorage` feature toggle keeps the form.io token in memory only
  instead of persisting it to localStorage. It is disabled by default.

## Bugfixes

* **Case list and task list no longer freeze the browser tab in certain browser versions**

  Opening a case list or the task list could freeze the browser tab completely in certain
  Chromium-based browser versions (reported on Microsoft Edge 148, reproduced on Chromium 141;
  the latest Chrome 151 and Edge 150 releases are not affected, nor are Firefox and Safari).
