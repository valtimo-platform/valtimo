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

### New enhancement title

New enhancement explanation.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Notificaties API | With more than one server, the cleanup of handled notifications no longer fails, and a failed cleanup no longer causes notifications to be handled twice. |
