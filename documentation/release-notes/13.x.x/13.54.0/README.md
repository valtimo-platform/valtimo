# 13.54.0

Release date: 11-11-2026

---

## Migration

* [Back-end migration](back-end-migration.md) — enable ShedLock in your own implementation if it
  runs on more than one server

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
| Dashboard | A long dashboard widget subtitle is now cut off with ellipsis instead of running out of the widget, and the full title and subtitle show on hover. |
| Dashboard | A bar chart widget with many categories no longer overflows its widget and overlaps other widgets. The legend now scrolls inside the widget. |
| Dashboard | A donut or bar chart widget with a long legend no longer shows two vertical scrollbars next to each other. |
| Forms | Disabled fields in forms now show their value in readable text, styled as read-only instead of faded grey. |
| Notificaties API | With more than one server, notifications are no longer handled twice and the cleanup of handled notifications no longer fails |