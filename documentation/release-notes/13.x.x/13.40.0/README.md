# 13.40.0

{% hint style="info" %}
**Release date 05-08-2026**
{% endhint %}

## New Features

* **Skip a waiting timer from the case Progress tab**

  When a process is waiting on a timer, users can now skip that timer directly from the **Progress** tab of a case. A
  skip button appears on the waiting timer in the process diagram; after confirming, the process continues immediately
  as if the timer had elapsed. The option is only available to users who have the `complete` permission on the timer
  (`OperatonTimer`) through Access Control (PBAC), and every skip is recorded in the case's audit trail.
  
* **New widget type: Text**

  A new **Text** widget is available on case widget tabs. It shows a fixed explanatory text — for example a
  work instruction, or a short introduction to the widgets around it — instead of data from the case. The
  content is authored in markdown (headings, lists, bold/italic, links, code, quotes and tables) and is part of
  the widget configuration, so it is the same for every case of that case definition. A title, an icon, an
  accent color, a width and an optional action button can be configured like on the other widgets. Links in the
  content open in a new tab, and the rendered content is sanitized so unsafe HTML and link schemes are removed.
  See the [widget documentation](../../../features/case/case-detail/tabs/widgets.md) for the configuration
  details.

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
  
* **Start form of a building block now opens in the panel**

  Starting a building block from the 'Start' menu of a case did nothing when the start form of its
  main process is configured to be shown in a panel. The panel now opens right away. Previously it
  only appeared after first opening the start form of a regular process in the panel.

* **Case list and task list no longer freeze the browser tab in certain browser versions**

  Opening a case list or the task list could freeze the browser tab completely in certain
  Chromium-based browser versions (reported on Microsoft Edge 148, reproduced on Chromium 141;
  the latest Chrome 151 and Edge 150 releases are not affected, nor are Firefox and Safari).

* **List action menus no longer detach from their trigger in scrolled lists**

  The row action menu (⋮) of lists now always opens directly below its trigger, also when the list has many columns
  and a horizontal scroll bar. The menu pane is rendered at document level so surrounding layout (scroll containers,
  modals) can no longer displace or clip it, and when the trigger is scrolled out of view while the menu is open, the
  menu is hidden instead of floating detached over unrelated content.
  
* **Importing a case definition with building-block process links no longer fails**

  Importing (or overwriting) a case definition that contains a building-block process link could fail on
  certain databases. This issue has now been resolved.
