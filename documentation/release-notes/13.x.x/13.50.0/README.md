# 13.50.0

Release date: 14-10-2026

{% hint style="warning" %}
This release contains security fixes. See [Security](#security) for details.
{% endhint %}

---

## New Features

### New feature title

New feature explanation.

---

## Enhancements

### New enhancement title

New enhancement explanation.

---

## Migration

* [Back-end migration](back-end-migration.md) — enable ShedLock in your own implementation if it
  runs on more than one server

---

## Bugfixes

| Area | Fix |
|------|-----|
| Notificaties API | With more than one server, notifications are no longer handled twice and the cleanup of handled notifications no longer fails |

---

## Security

| Severity | Fix |
|----------|-----|
| Medium | The dropdown list and translation data endpoints no longer let a logged-in user read JSON files outside the `config/dropdown` and `config/translation` folders, such as plugin configurations or permission files, by putting `../` in the requested key |
