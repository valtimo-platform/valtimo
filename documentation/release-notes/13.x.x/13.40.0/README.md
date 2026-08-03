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

* **List action menus no longer detach from their trigger in scrolled lists**

  The row action menu (⋮) of lists now always opens directly below its trigger, also when the list has many columns
  and a horizontal scroll bar. The menu pane is rendered at document level so surrounding layout (scroll containers,
  modals) can no longer displace or clip it, and when the trigger is scrolled out of view while the menu is open, the
  menu is hidden instead of floating detached over unrelated content.
