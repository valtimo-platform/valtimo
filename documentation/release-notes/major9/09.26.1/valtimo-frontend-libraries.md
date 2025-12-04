# Valtimo frontend libraries (5.15.1)

## New Features

No new features.

## Bugfixes

The following bugs were fixed:

*   **Connector configuration shows wrong configuration**

    The popup to edit a connector configuration properties, sometimes showed the properties of another connector. This has been fixed.

## Breaking changes

No breaking changes.

## Deprecations

No new deprecations.

## Known issues

This version has the following known issues:

* **Viewing and editing DMN tables does not work if there is no 'featureToggles' object present in the environment configuration.**
  * Discovered in version 9.26.0
  * As a workaround, an empty 'featureToggles' object can be added to the environment configuration file(s).
