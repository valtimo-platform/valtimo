# 13.54.0

Release date: 11-11-2026

---

## Migration

* [Scheduled jobs on more than one server](https://ritense-1.gitbook.io/valtimo-dev-docs/operations/scheduled-jobs)
  — enable ShedLock in your own implementation if it runs on more than one server. No action is
  needed when you use the default Docker images.

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

| Area | Fix |
|------|-----|
| Case management | Actions hidden from the start menu stay hidden after creating a new version of the case type or changing the building block version of the action. |
| Case management | Importing a case definition lists the plugin configurations used by its processes again, so they can be mapped to plugin configurations in this environment. |
| Dashboard | A long dashboard widget subtitle is now cut off with ellipsis instead of running out of the widget, and the full title and subtitle show on hover. |
| Dashboard | A bar chart widget with many categories no longer overflows its widget and overlaps other widgets. The legend now scrolls inside the widget. |
| Dashboard | A donut or bar chart widget with a long legend no longer shows two vertical scrollbars next to each other. |
| Forms | Disabled fields in forms now show their value in readable text, styled as read-only instead of faded grey. |
| Notificaties API | With more than one server, the cleanup of handled notifications no longer fails, and a failed cleanup no longer causes notifications to be handled twice. |

---

## Security

| Severity | Fix |
|----------|-----|
| High | The Objecten API plugin now validates object URLs more strictly and only accepts URLs that belong to the Objecten API it is configured with. If your Objecten API returns object URLs with a different host, port or path than the URL in the plugin configuration, update the plugin configuration to match, otherwise those objects can no longer be opened, changed or deleted. |
| High | The deprecated Documenten API endpoints for downloading, changing and deleting a document now check access more strictly. A document is only available through these endpoints when it is linked to a case the user can view. These endpoints will be removed in Valtimo 14. Use the endpoints that take the case as input instead. |
| High | Access checks on the documents of a case are stricter. Downloading, previewing, changing and deleting a document now also requires permission to view the case the document belongs to. |
