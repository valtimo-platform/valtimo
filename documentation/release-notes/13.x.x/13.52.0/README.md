# 13.52.0

Release date: 28-10-2026

{% hint style="warning" %}
This release contains security fixes. See [Security](#security) for details.
{% endhint %}

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
| Notificaties API | With more than one server, notifications are no longer handled twice and the cleanup of handled notifications no longer fails |
| Forms | Clicking the submit button of a form more than once no longer submits the form multiple times; after a failed submit the button can be used again. |

---

## Security

| Severity | Fix |
|----------|-----|
| High | The process instance search and count endpoints no longer let any logged-in user list the process instances of all cases or search their process variables. They are now only available to administrators. The search endpoints and the count by process definition name will be removed in a future version. |
| Medium | Adding a comment to a process instance is now only available to administrators, and will be removed in a future version. |
| Medium | Deploying a version of a process definition with shortened timers is now only available to administrators, and will be removed in a future version. |
