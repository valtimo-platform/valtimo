# 13.45.0

Release date: 09-09-2026

---

## Migration

* [Front-end migration](front-end-migration.md) — optional steps to get the full first-page-load
  improvement in your own implementation

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

### Faster first page load

Opening Valtimo for the first time, or the first time after an update, now downloads roughly half
as much data: 2.0 MB instead of 4.1 MB. The Swagger viewer, the DMN editor, the JSON schema editor
and the map widget are fetched only when the screen that uses them is opened, and several scripts
that were loaded on every page but never used have been removed. The deployed image is also
considerably smaller, because only the part of the code editor that is actually used is shipped.

### Task list updates without interrupting

The task list no longer shows a loading state when it picks up changed tasks by itself. The rows
are replaced in place, so searching, sorting and reading are not interrupted.

### System processes can always be edited

A process marked as a system process can now be changed and saved like any other process, which creates a new version of it. Importing a process package also overwrites an existing system process instead of being refused. Finalised case definitions keep using the version of the system process they were configured with, so an existing case is not affected by the change.

The setting that could block changes to system processes no longer has any effect and will be removed. Installations that still use it get a warning when the application starts.

### Refreshed process migration screen

Admin > Other > Process migration has the standard Valtimo look and feel, with clearer labels for the source and target process, the versions, and the activities to map.

---

## Bugfixes

| Area             | Fix                                                                                                                             |
|------------------|---------------------------------------------------------------------------------------------------------------------------------|
| Case and task lists | Paging through a list sorted on a column that repeats values, such as the assignee, no longer shows the same case or task on two pages while leaving others out |
| Case definitions | The version picker lists every version of a case again, instead of only the active one, and its pagination works                |
| Case definitions | Versions are ordered by version number rather than alphabetically, so 1.0.10 comes after 1.0.9                                  |
| Case migration   | The source and target version dropdowns offer every version of the selected case again, instead of only one                     |
| Case migration   | When upgrading from Valtimo 12, a sub-process that several cases reach through the same shared process is now linked to every one of those cases instead of only the first |
| Cases            | A case can be deleted when the zaak it is linked to has already been removed in the Zaken API                                   |
| Documenten API   | A file uploaded with the Documenten API upload field in a form flow is added to the case when the form flow finishes            |
| Documents        | A document is added to a case once, however many times Save is clicked in the metadata window                                   |
| Forms            | A currency field with a default value shows the full amount, instead of one hundredth of it                                     |
| Forms            | The default value of a currency field is kept and shown in the form builder, instead of being reset to zero once the component is saved |
| Plugins          | Creating a zaakdossier via the verzoek plugin with an empty initiator type no longer fails when creating the initiator zaakrol   |
| Plugins          | The verzoek plugin offers every case version again when picking one, instead of only the active one                              |
| Process links    | Reopening a configured plugin action shows the plugin it was set up with, instead of another plugin using the same action name  |
| Process migration | A system process can be migrated after it was changed                                                                          |
| Processes        | Completing or cancelling a process with a message no longer logs an error when the process ends while a user task is still open  |
| Task list        | The **All cases** task list picks up new and completed tasks by itself, like a list for a single case definition already did     |
| Plugins          | Notificaties API abonnementen configured through the admin UI now receive notifications without restarting GZAC, and their subscription is removed when the plugin configuration is deleted |

## Breaking Changes (minimum)
A separate task create-initiator-zaak-rol-kvk has been added to the create-zaakdossier BPMN to handle the create-niet-natuurlijk-persoon-zaak-rol plugin action. The existing process link to create-niet-natuurlijk-persoon-zaak-rol should be rerouted to this new task.
