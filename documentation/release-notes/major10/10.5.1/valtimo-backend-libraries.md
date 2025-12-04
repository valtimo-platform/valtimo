# Valtimo backend libraries

## New Features

*   **Mapped fields in the Verzoek plugin are not required any more**

    When processing a Verzoek object, the Verzoek plugin maps data from the object to the Valtimo document using a mapping. Fields that were included in this mapping were required. That has been changed: only fields that are included in the Verzoek object will be mapped. Note that input validation can still be done with JsonSchema, both on the Object and the Valtimo document.

## Bugfixes

No bugfixes.

## Breaking changes

No breaking changes.

## Deprecations

No deprecations.

## Known issues

No known issues.
