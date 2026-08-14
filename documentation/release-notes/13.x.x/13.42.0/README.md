# 13.42.0

{% hint style="info" %}
**Release date 19-08-2026**
{% endhint %}

## New Features

* **Documenten API WOPI plugin**

  The new "Documenten API WOPI plugin" allows users to open, edit and collaborate on documents using the WOPI 
  protocol. This plugin depends on Baseflow's CG-DMF implementation of the Document Registratie Component and requires
  the availability of an online document editing suite that supports the WOPI protocol (e.g., Collabora or ONLYOFFICE).

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes


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
