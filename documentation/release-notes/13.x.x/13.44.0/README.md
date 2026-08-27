# 13.44.0

Release date: 02-09-2026

---

## New Features

### New feature title

New feature explanation.

---

## Enhancements

### Clearing a case field follows the case model

Emptying a field now follows what the case model allows: the field is either set to empty or removed, and a field the model requires is refused instead of silently leaving the case invalid.

### System processes can always be edited

A process marked as a system process can now be changed and saved like any other process, which creates a new version of it. Importing a process package also overwrites an existing system process instead of being refused. Finalised case definitions keep using the version of the system process they were configured with, so an existing case is not affected by the change.

The `valtimo.process.systemProcessUpdatable` property no longer does anything and will be removed. If your installation set it to `false` to keep system processes unchanged, that protection is gone — the application logs a warning at startup when it is still set.

### Refreshed process migration screen

Admin > Other > Process migration has the standard Valtimo look and feel, with clearer labels for the source and target process, the versions, and the activities to map.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Cases | The process selector on the Progress tab shows long process names in full instead of cutting them off |
| Cases | The progress tab shows the name of every process, instead of leaving some blank |
| Plugins | Required fields such as the authentication configuration have to be filled in before a plugin configuration can be saved |
| Case configuration | A field path the case model does not allow is rejected instead of accepted |
| Field pickers | A case model with an unreadable reference no longer stops every field picker from loading |
| Field pickers | Lists in a case can be picked as a field, not only as a collection |
| Process migration | A system process can be migrated after it was changed |
