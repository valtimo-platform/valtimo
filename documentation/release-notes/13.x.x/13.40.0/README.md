# 13.40.0

{% hint style="info" %}
**Release date 05-08-2026**
{% endhint %}

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

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
