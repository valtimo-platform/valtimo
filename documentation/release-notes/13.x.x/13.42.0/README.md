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


* **A form flow can now be used as the start form of a building block**

  Starting a building block from the actions of a case now opens its form flow start form, and submitting that
  form starts the building block version that is linked to the case. Previously the start form did not open at
  all and the building block could not be started this way, while the same setup with a regular form did work.

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
* Addressed several reported high-severity front-end security alerts. The `js-yaml`, `fast-uri`, `ip-address`,
  `postcss` and `brace-expansion` dependencies were updated to fixed versions. The remaining alerts cannot be
  resolved without a major upgrade: the Swagger UI `immutable` fix requires Node 22, and the Angular alerts require the
  next major Angular version. Both remain tracked.
