# 13.44.0

Release date: 02-09-2026

---

## New Features

### E-mail preview form component

Show a rendered preview of an e-mail inside a form. The new **E-mail preview** Form.io
component renders the e-mail HTML stored in a case or process variable — for example an
automatically generated confirmation — so a case worker can review the exact e-mail in a
user task. The preview keeps its light, e-mail client-like appearance in dark mode. See the
[E-mail preview component documentation](../../../configuration-guides/cases/forms/email-preview-component.md)
for configuration details.

---

## Enhancements

### Clearing a case field follows the case model

Emptying a field now follows what the case model allows: the field is either set to empty or removed, and a field the model requires is refused instead of silently leaving the case invalid.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Case configuration | A field path the case model does not allow is rejected instead of accepted |
| Cases | The process selector on the Progress tab shows long process names in full instead of cutting them off |
| Cases | The progress tab shows the name of every process, instead of leaving some blank |
| Plugins | Re-saving a plugin configuration removes settings from older versions that are no longer used |
| List columns | The **Path** field is empty again when the column modal is reopened after cancelling |
| Plugins | Required fields such as the authentication configuration have to be filled in before a plugin configuration can be saved |
| Field pickers | A case model with an unreadable reference no longer stops every field picker from loading |
| Field pickers | Lists in a case can be picked as a field, not only as a collection |
| Case management | A process in a finalised case version shows all of its settings, read-only, instead of only the process link |
