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

The `valtimo.process.systemProcessUpdatable` property no longer does anything and will be removed. If your installation set it to `false` to keep system processes unchanged, that protection is gone — the application logs a warning at startup when it is still set.

### Refreshed process migration screen

Admin > Other > Process migration has the standard Valtimo look and feel, with clearer labels for the source and target process, the versions, and the activities to map.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Process migration | A system process can be migrated after it was changed |
| Case definitions | The version picker lists every version of a case again, instead of only the active one, and its pagination works |
| Case migration | The source and target version dropdowns offer every version of the selected case again, instead of only one |
| Plugins | The verzoek plugin offers every case version again when picking one, instead of only the active one |
| Case definitions | Versions are ordered by version number rather than alphabetically, so 1.0.10 comes after 1.0.9 |
