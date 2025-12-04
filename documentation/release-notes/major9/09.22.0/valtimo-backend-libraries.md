# Valtimo backend libraries (9.22.0)

## New Features

No new features.

## Bugfixes

The following bugs were fixed:

*   **SonarQube issues**

    SonarQube scanned the backend code for bugs and vulnerabilities. SonarQube found:

    * 21 Bugs
    * 7 Vulnerabilities

    All bugs and vulnerabilities that SonarQube found have been solved.

## Breaking changes

No breaking changes.

## Deprecations

No new deprecations.

## Known issues

This version has the following known issues:

*   **Multiple existing form associations on process definition**

    When multiple start forms are associated with a single process definition the user is unable to start a new case of that specific type.
* **Form flow definition does not read `nextStep` property**
  * Discovered in version 9.19.0
  * Instead of using `nextStep`, `nextSteps` can be used.
