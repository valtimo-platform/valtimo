# 13.53.0

Release date: 04-11-2026

---

## New Features

### New feature title

New feature explanation.

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
| Widgets | A widget display condition with a number value, such as `0`, now compares numerically against a number field. The `${0}` workaround is no longer needed. |
| Process editor | Expression fields in the BPMN editor now remember the Manual mode after saving, and chained expressions open in Manual mode instead of the Dropdown. |
