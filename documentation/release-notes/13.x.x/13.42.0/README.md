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

* **Pages no longer break when a user has been deleted**

  Valtimo shows who created or was assigned to something by looking up that person's name. When that user had
  since been deleted, the lookup failed and took the whole page down with it: the tab overview of a case type,
  for example, could no longer be opened at all. A name that can no longer be found is now simply left out
  instead of causing an error, and tasks are no longer automatically assigned to a user that no longer exists.
  
* **Deleting a process linked to a case now cleans up properly**

  When a process that was linked to a case definition was deleted, the link remained in the database.
  This could cause errors when viewing or exporting the case definition. Existing orphaned
  links from earlier versions are automatically cleaned up during upgrade.

* **Form flow steps with a colon in their expressions work again after import**

  Importing a case no longer breaks form flow steps whose start or complete expression contains a colon, such as one
  that saves submission data to a document or process variable. These steps stopped working after import because part
  of the expression was cut off.

* **Object permissions are checked before the object is retrieved**

  A user without permission to view objects is now refused before anything is requested from the Objecten API.
  Previously the object was retrieved first, so the answer of the Objecten API could tell such a user whether an
  object exists.

## Security

* **Permission checks only accept known resource types**

  When Valtimo was asked whether a user may perform an action, the resource type in that question was taken at
  face value, which allowed any signed-in user to make the server load arbitrary internal parts of the
  application. Only the resource types that can be selected under **Access control** are accepted now, and
  anything else is answered as "not permitted", so normal use is unaffected.
