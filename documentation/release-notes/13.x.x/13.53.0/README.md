# 13.53.0

Release date: 04-11-2026

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

### Hide document actions that aren't available

Row actions in the case document list can now be hidden entirely instead of only shown disabled,
and plugins can contribute their own actions to that list. The **Preview** action is hidden
rather than shown disabled when no preview plugin is configured for the document's Documenten API.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Notificaties API | A changed **Authentication header** is now passed on to Open Notificaties on save, so notificaties keep arriving |
| Widgets | A widget display condition with a number value, such as `0`, now compares numerically against a number field. The `${0}` workaround is no longer needed. |
| Process editor | Expression fields in the BPMN editor now remember the Manual mode after saving, and chained expressions open in Manual mode instead of the Dropdown. |
