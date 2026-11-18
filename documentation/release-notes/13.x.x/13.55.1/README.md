# 13.55.1

Release date: 18-11-2026

---

## New Features

### Manual abonnement registration for the Notificaties API

Valtimo can now receive notificaties from Open Notificaties when all traffic passes through a
gateway that checks certificates. Set a Notificaties API configuration to **Manual** abonnement
registration and create the abonnement in Open Notificaties yourself, with the callback URL that
the configuration shows. See the
[Notificaties API documentation](../../../configuration-guides/plugins/notificaties-api.md) for
details.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Forms | An IBAN or currency field with a default value now counts as filled in straight away, also when a condition shows the field or it is part of a group of fields. |
| Notificaties API | A changed **Authentication header** is now passed on to Open Notificaties on save, so notificaties keep arriving |
