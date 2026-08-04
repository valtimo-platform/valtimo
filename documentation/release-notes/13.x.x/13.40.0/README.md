# 13.40.0

{% hint style="info" %}
**Release date 05-08-2026**
{% endhint %}

## Bugfixes

* **Importing a case definition with building-block process links no longer fails on PostgreSQL 15+**

  Importing (or overwriting) a case definition that contains a building-block process link could fail on
  PostgreSQL 15 and newer with `column "input_mappings" is of type jsonb but expression is of type integer`.
  The building-block process link stores its mappings in a secondary table, which Hibernate wrote with a
  `MERGE` (upsert) that mis-typed the JSONB columns. The secondary row is now written with a plain
  insert/update, so these imports succeed again.
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

* **Case definition name entered when creating a draft version is now saved**

  The *Case definition name* filled in when creating a draft version based on an existing version is now saved on
  the new draft. Previously it was discarded and the draft kept the name of the version it was based on.

* **Case management screens now show the name of the selected version**

  The page title and breadcrumb now show the case definition name of the version you have selected. Previously the
  title used the title from the document definition and the breadcrumb the name of the globally active version, so a
  changed name was not visible. The breadcrumb also no longer stays behind after leaving version management.

* **Case menu and version indicator now update when a version is made globally active**

  Making a version globally active now updates the case menu and the *set as globally active* action immediately.
  Previously the menu kept showing the previously active version and its name until the page was reloaded.

* **Expanded menu groups stay open when the menu refreshes**

  An expanded menu group such as *Cases* now stays open when the menu refreshes its contents, for example after
  uploading a case definition. Previously the group collapsed.
  
* **Case list and task list no longer freeze the browser tab in certain browser versions**

  Opening a case list or the task list could freeze the browser tab completely in certain
  Chromium-based browser versions (reported on Microsoft Edge 148, reproduced on Chromium 141;
  the latest Chrome 151 and Edge 150 releases are not affected, nor are Firefox and Safari).

* **List action menus no longer detach from their trigger in scrolled lists**

  The row action menu (⋮) of lists now always opens directly below its trigger, also when the list has many columns
  and a horizontal scroll bar. The menu pane is rendered at document level so surrounding layout (scroll containers,
  modals) can no longer displace or clip it, and when the trigger is scrolled out of view while the menu is open, the
  menu is hidden instead of floating detached over unrelated content.

* **Case list and task list no longer freeze the browser tab in certain browser versions**

  Opening a case list or the task list could freeze the browser tab completely in certain
  Chromium-based browser versions (reported on Microsoft Edge 148, reproduced on Chromium 141;
  the latest Chrome 151 and Edge 150 releases are not affected, nor are Firefox and Safari).

* **Importing a case definition with building-block process links no longer fails**

  Importing (or overwriting) a case definition that contains a building-block process link could fail on
  certain databases. This issue has now been resolved.
