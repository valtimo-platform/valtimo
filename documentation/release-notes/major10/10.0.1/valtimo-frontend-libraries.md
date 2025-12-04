# Frontend libraries 10.0.1

## New Features

No new features.

## Bugfixes

The following bugs were fixed:

* **Occasional 403 error notification**

  The Valtimo website would occasionally show an 403 error notification. This has been fixed.

## Breaking changes

No breaking changes.

## Deprecations

No new deprecations.

## Known issues

This version has the following known issues:

* **Viewing and editing DMN tables does not work if there is no 'featureToggles' object present in the environment configuration.**

  * Discovered in version 9.26.0
  * As a workaround, an empty 'featureToggles' object can be added to the environment configuration file(s).
