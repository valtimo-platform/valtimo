# 13.50.0

Release date: 14-10-2026

---

## Migration

* [Back-end migration](back-end-migration.md) — enable ShedLock in your own implementation if it
  runs on more than one server

---

## Bugfixes

| Area | Fix |
|------|-----|
| Notificaties API | With more than one server, notifications are no longer handled twice and the cleanup of handled notifications no longer fails |
