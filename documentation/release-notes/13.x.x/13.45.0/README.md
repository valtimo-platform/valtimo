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

### Case migration

Cases no longer have to stay on the version they were started on. A **migration plan** moves running
cases from an older case definition version onto a newer one — their data, their running process, and
their building blocks — so a configuration change reaches the cases that are already in progress
instead of only the ones started after it.

<figure><img src="../../../assets/configuration-guides/cases/migration/01-migration-tab.png" alt=""><figcaption>Migration plans on a case definition version</figcaption></figure>

A plan is configured in the UI on the version cases should end up on, and covers:

- **Which cases move** — a source version to migrate from, narrowed with conditions on any case value.
  A plan can reach several versions back in one step, or migrate the cases of a case definition that
  was renamed or replaced.
- **What changes** — patches that reshape the case data, and instructions that move each running
  process onto the new process model.
- **When it runs** — manually from a button, at a scheduled moment, or after another plan finishes.

Migration is all-or-nothing per case: a case either migrates fully or is left untouched and reported
with the reason, while the rest continue. Fix the cause and run the plan again — cases that already
migrated are skipped.

A run happens in the background, so nothing has to stay open while tens of thousands of cases move.
The Migration tab follows the progress, and a run interrupted by a restart of the application resumes
on its own and continues where it left off.

**[Try it out →](../../../configuration-guides/cases/migration/README.md)**

### Try a migration before running it

A **dry run** goes through exactly the cases a plan would migrate and simulates migrating every one of
them against real data, then rolls it all back. Nothing is changed and nothing is left behind, so it is
safe against production data — and because it performs the real migration rather than a separate
simulation, what it reports is what a real run will do. The report lists the cases that would fail with
the full reason, and the cases that would migrate but where the plan would not do everything it
describes.

**[Try it out →](../../../configuration-guides/cases/migration/running-a-plan.md)**

### Building blocks move with the case

A new case definition version may change how a case is divided into building blocks, not just its data
and process. A migration plan handles that in the same run: it can create building blocks on each
migrated case, taking over a process the case is already running, and dissolve building blocks by
handing their data and processes back.

Existing building blocks follow their case automatically. The case's new version says which building
block version belongs where, and the block is brought up to it — or carried over to a different
building block entirely, which is how one building block replaces another without abandoning the
instances already running. Building block versions have a **Migration** tab of their own for the plans
that describe those steps.

**[Try it out →](../../../configuration-guides/cases/migration/building-blocks.md)**

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
