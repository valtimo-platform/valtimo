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

* **A migration plan's key is generated from its title**

  When creating a migration plan, its key now follows the title you type instead of having to be entered by
  hand. It is made unique against the plans that already exist on that version, and can still be adjusted
  before saving.

## Bugfixes


* **Form flow steps with a colon in their expressions work again after import**

  Importing a case no longer breaks form flow steps whose start or complete expression contains a colon, such as one
  that saves submission data to a document or process variable. These steps stopped working after import because part
  of the expression was cut off.

* **Document schemas that refer to themselves no longer crash the application**

  A case document schema in which a property refers back to the schema itself could make the server run out of stack
  space while reading it, for example when listing the values that can be used in a mapping or when migrating
  documents. Such schemas are now read up to a maximum nesting depth.

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
