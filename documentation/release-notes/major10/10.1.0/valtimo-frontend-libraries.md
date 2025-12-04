# Frontend libraries 10.1.0

## New Features

The following features were added:

* **Improved error messages in popup**

  The popup showing the error messages has been improved in several ways:
  - It now more often shows the details of the error.
  - It now more often shows a reference ID of the error.
  - When the popup is clicked, it won't disappear. Making it easier to copy the error from the popup. 

* **Supporting process title translatable**

  The option to translate subprocess title is now added. A new key with the value of the `processDefinitionKey` can be used in the translation file to override the default.



## Bugfixes

No bugfixes.

## Breaking changes

No breaking changes.

## Deprecations

No new deprecations.

## Known issues

This version has the following known issues:

* **Viewing and editing DMN tables does not work if there is no 'featureToggles' object present in the environment configuration.**

  * Discovered in version 9.26.0
  * As a workaround, an empty 'featureToggles' object can be added to the environment configuration file(s).
