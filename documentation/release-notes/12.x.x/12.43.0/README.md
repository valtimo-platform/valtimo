# 12.43.0

## Enhancements

* **Searchable dropdowns on the process migration and Progress screens, and localized date pickers**

  The **Source Definition**, **Source Version**, **Target Definition**, **Target Version** and **Choose Target**
  dropdowns on the **Process migration** screen, and the process dropdown on the **Progress** tab of a case, are now
  combo boxes, so typing in the field filters the available entries instead of having to scroll through the full list.
  This makes it easier to find a process in an environment with many process definitions. Selecting a source definition
  now also preselects the same definition as target; clearing the source definition clears the source version, target
  definition and target version as well, and clearing the target definition clears the target version, so no stale
  selection is left behind. The labels of these fields are now translated too. In addition, date pickers in form.io
  forms are shown in the language the user selected in the application, so month and day names appear in Dutch when the
  interface is set to Dutch; switching the language updates the date pickers that are already on screen immediately,
  without reloading the page, and languages other than Dutch and English fall back to English.
