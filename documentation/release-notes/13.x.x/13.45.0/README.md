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

---

## Bugfixes

| Area | Fix |
|------|-----|
| Case definitions | The version picker lists every version of a case again, instead of only the active one, and its pagination works |
| Case migration | The source and target version dropdowns offer every version of the selected case again, instead of only one |
| Plugins | The verzoek plugin offers every case version again when picking one, instead of only the active one |
| Case definitions | Versions are ordered by version number rather than alphabetically, so 1.0.10 comes after 1.0.9 |
| Task list | The **All cases** task list picks up new and completed tasks by itself, like a list for a single case definition already did |
