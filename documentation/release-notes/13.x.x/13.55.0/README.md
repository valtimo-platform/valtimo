# 13.55.0

Release date: 18-11-2026

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

### Faster team lists and case lists

The team list, the case list and assigning a case to a team no longer load every team and all
its members at once. These pages respond faster and use less memory in environments with many
teams or large teams. Case lists also load case tags in fewer database queries.

### Editable dashboard key

When you create a dashboard, you can now edit its key, as elsewhere in the application.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Case management | The start menu for supporting processes on a case now updates when the internal status of the case changes. |
| Case management | Drag-and-drop reordering of case tabs, widgets and other lists now works in Safari. |
| Case management | Importing a new version of a case definition no longer fails when its search fields, case list columns or task list columns use a property that only exists in that version's document definition. |
| Dashboard | Dashboards and widgets with a name without letters, such as `2026`, now get a valid key. |
| Dashboard | Dashboards and widgets that were saved with an empty key can be opened, edited and deleted again. |
| Notificaties API | With more than one server, the cleanup of handled notifications no longer fails, and a failed cleanup no longer causes notifications to be handled twice. |
| Plugins | The Verzoek plugin now validates its document mappings against the selected case definition version instead of the active version. |

{% hint style="warning" %}
Dashboards and widgets with an empty key get a new key when you upgrade, such as `dashboard_2026` or `widget_2026`. Update any access control conditions or autodeploy files that refer to the empty key.
{% endhint %}
