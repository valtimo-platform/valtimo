# 13.45.0

Release date: 09-09-2026

---

## New Features

### New feature title

New feature explanation.

---

## Enhancements

### System processes can always be edited

A process marked as a system process can now be changed and saved like any other process, which creates a new version of it. Importing a process package also overwrites an existing system process instead of being refused. Finalised case definitions keep using the version of the system process they were configured with, so an existing case is not affected by the change.

The setting that could block changes to system processes no longer has any effect and will be removed. Installations that still use it get a warning when the application starts.

### Refreshed process migration screen

Admin > Other > Process migration has the standard Valtimo look and feel, with clearer labels for the source and target process, the versions, and the activities to map.

---

## Bugfixes

| Area             | Fix                                                                                                                           |
|------------------|-------------------------------------------------------------------------------------------------------------------------------|
| Case definitions | The version picker lists every version of a case again, instead of only the active one, and its pagination works              |
| Case migration   | The source and target version dropdowns offer every version of the selected case again, instead of only one                   |
| Plugins          | The verzoek plugin offers every case version again when picking one, instead of only the active one                           |
| Case definitions | Versions are ordered by version number rather than alphabetically, so 1.0.10 comes after 1.0.9                                |
| Plugins          | Creating a zaakdossier via the verzoek plugin with an empty initiator type no longer fails when creating the initiator zaakrol |
| Process migration | A system process can be migrated after it was changed |

## Breaking Changes (minimum)
A separate task create-initiator-zaak-rol-kvk has been added to the create-zaakdossier BPMN to handle the create-niet-natuurlijk-persoon-zaak-rol plugin action. The existing process link to create-niet-natuurlijk-persoon-zaak-rol should be rerouted to this new task.
