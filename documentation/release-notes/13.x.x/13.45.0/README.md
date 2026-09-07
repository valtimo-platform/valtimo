# 13.45.0

Release date: 09-09-2026

---

## New Features

### Manual task list refresh

The task list updates itself as soon as tasks change. With the new **Enable manual task list
refresh** toggle under **Admin** > **Settings** > **Feature toggles**, the list keeps its
contents until a case worker presses the new **Refresh tasks** button in the list toolbar
instead — useful for teams that work through a list top to bottom and do not want rows to move
while they do.

---

## Enhancements

### Task list updates without interrupting

The task list no longer shows a loading state when it picks up changed tasks by itself. The rows
are replaced in place, so searching, sorting and reading are not interrupted.

### System processes can always be edited

A process marked as a system process can now be changed and saved like any other process, which creates a new version of it. Importing a process package also overwrites an existing system process instead of being refused. Finalised case definitions keep using the version of the system process they were configured with, so an existing case is not affected by the change.

The setting that could block changes to system processes no longer has any effect and will be removed. Installations that still use it get a warning when the application starts.

### Refreshed process migration screen

Admin > Other > Process migration has the standard Valtimo look and feel, with clearer labels for the source and target process, the versions, and the activities to map.

### Stop the other processes of a case and carry on

A process can now stop all other running processes of its case and then continue its own flow, so a rejection can clear the remaining work and still set a status or send a letter. It sits in the expression dropdown in the BPMN modeler next to the existing option, which stops every process of the case including the one that asks.

---

## Bugfixes

| Area             | Fix                                                                                                                             |
|------------------|---------------------------------------------------------------------------------------------------------------------------------|
| Case definitions | The version picker lists every version of a case again, instead of only the active one, and its pagination works                |
| Case definitions | Versions are ordered by version number rather than alphabetically, so 1.0.10 comes after 1.0.9                                  |
| Case migration   | The source and target version dropdowns offer every version of the selected case again, instead of only one                     |
| Case migration   | When upgrading from Valtimo 12, a sub-process that several cases reach through the same shared process is now linked to every one of those cases instead of only the first |
| Cases            | A case can be deleted when the zaak it is linked to has already been removed in the Zaken API                                   |
| Plugins          | Creating a zaakdossier via the verzoek plugin with an empty initiator type no longer fails when creating the initiator zaakrol   |
| Plugins          | The verzoek plugin offers every case version again when picking one, instead of only the active one                              |
| Process migration | A system process can be migrated after it was changed                                                                          |
| Processes        | Completing or cancelling a process with a message no longer logs an error when the process ends while a user task is still open  |
| Task list        | The **All cases** task list picks up new and completed tasks by itself, like a list for a single case definition already did     |

## Breaking Changes (minimum)
A separate task create-initiator-zaak-rol-kvk has been added to the create-zaakdossier BPMN to handle the create-niet-natuurlijk-persoon-zaak-rol plugin action. The existing process link to create-niet-natuurlijk-persoon-zaak-rol should be rerouted to this new task.
