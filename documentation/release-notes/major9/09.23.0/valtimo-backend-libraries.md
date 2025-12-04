# Valtimo backend libraries (9.23.0)

## New Features

The following features were added:

*   **Allow external fields to have a nested formfield.key structure**

    Previously an external field definition only supported 1 level keys like:

    * `ex.keyName`

    Now its possible to define nested stuctures like:

    * `ex.keyName.anotherKeyName` Resulting in structures that can be mapped into the prefilling/submission phase:

    ```json
    {
        "ex" : {
            "keyName" : {
                 "anotherKeyName" : "someValue"
            }
        }
    }
    ```
*   **Case assignee**

    It is now possible to assign and unassign a user to a case.

    For more information on using this feature see [this page](broken-reference).

    Information about the endpoints can be found [here](broken-reference).

## Bugfixes

The following bugs were fixed:

*   **Form flow incompatible with PostgreSQL**

    The Form flow module was failed when loading form flows from the configuration files when using the PostgreSQL DBMS. This has now been resolved.

## Known issues

This version has the following known issues:

* **Form flow definition does not read `nextStep` property**
  * Discovered in version 9.19.0
  * Instead of using `nextStep`, `nextSteps` can be used.
