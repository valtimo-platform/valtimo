# 13.43.0

Release date: 26-08-2026

---

## Enhancements

### Case definition key and version in case inspection

The metadata tab of the case inspection page now displays the case definition key and version. This makes it clear which version of a case definition a case belongs to.

### More filter options for the task count widget

A task count widget can now be limited to a single case type, so a dashboard can show the tasks of one case type instead of all tasks a user is allowed to see. The conditions of the widget can also be grouped: every group combines its conditions with `AND` or `OR`, and groups can be nested. This makes counts possible that could not be configured before, such as the tasks that are assigned and have one of two names. Existing task count widgets keep working unchanged.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Draft environments | Default Spring profiles now correctly enable draft mode |
| Search fields | Date searches return results with correct date format |
| Document schemas | Recursive schema references no longer crash the server |
| Cases | A case that cannot be found no longer stops a process, an assignment or a note |
| Dashboard | Donut charts with many categories display the circle correctly |
| Notificaties API | Subscription registration no longer causes a restart loop on startup |
| Case export | Forms shown in a widget are included in the case export |
