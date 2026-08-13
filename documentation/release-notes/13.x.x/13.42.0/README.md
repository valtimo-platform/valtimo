# 13.42.0

{% hint style="info" %}
**Release date 19-08-2026**
{% endhint %}

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* **Deleting a process linked to a case now cleans up properly**

  When a process that was linked to a case definition was deleted, the link remained in the database.
  This could cause errors when viewing or exporting the case definition. Existing orphaned
  links from earlier versions are automatically cleaned up during upgrade.
