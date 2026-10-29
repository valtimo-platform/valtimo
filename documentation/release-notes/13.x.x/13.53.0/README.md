# 13.53.0

Release date: 04-11-2026

---

## New Features

### Manual abonnement registration for the Notificaties API

Valtimo can now receive notificaties from Open Notificaties when all traffic passes through a
gateway that checks certificates. Set a Notificaties API configuration to **Manual** abonnement
registration and create the abonnement in Open Notificaties yourself: Valtimo shows the callback
URL, channels and filters it needs. See the
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
| Widgets | A widget display condition with a number value, such as `0`, now compares numerically against a number field. The `${0}` workaround is no longer needed. |
