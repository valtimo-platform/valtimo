# 13.45.0

Release date: 09-09-2026

---

## New Features

### New feature title

New feature explanation.

---

## Enhancements

### New enhancement title

New enhancement explanation.

---

## Bugfixes

| Area             | Fix                                                                                                                           |
|------------------|-------------------------------------------------------------------------------------------------------------------------------|
| Case definitions | The version picker lists every version of a case again, instead of only the active one, and its pagination works              |
| Case migration   | The source and target version dropdowns offer every version of the selected case again, instead of only one                   |
| Cases            | A case can be deleted when the zaak it is linked to has already been removed in the Zaken API                                 |
| Plugins          | The verzoek plugin offers every case version again when picking one, instead of only the active one                           |
| Case definitions | Versions are ordered by version number rather than alphabetically, so 1.0.10 comes after 1.0.9                                |
| Plugins          | Creating a zaakdossier via the verzoek plugin with an empty initiator type no longer fails when creating the initiator zaakrol |
| Processes        | Completing or cancelling a process with a message no longer logs an error when the process ends while a user task is still open |

## Breaking Changes (minimum)
A separate task create-initiator-zaak-rol-kvk has been added to the create-zaakdossier BPMN to handle the create-niet-natuurlijk-persoon-zaak-rol plugin action. The existing process link to create-niet-natuurlijk-persoon-zaak-rol should be rerouted to this new task.
