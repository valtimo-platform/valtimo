# 13.54.0

Release date: 11-11-2026

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

## Enhancements

### New enhancement title

New enhancement explanation.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Notificaties API | A changed **Authentication header** is now passed on to Open Notificaties on save, so notificaties keep arriving |
| Dashboard | A long dashboard widget subtitle is now cut off with ellipsis instead of running out of the widget, and the full title and subtitle show on hover. |
