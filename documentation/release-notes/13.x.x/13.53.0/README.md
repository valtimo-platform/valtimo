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

### Long texts in forms can be saved

A text of more than 4000 characters, such as a long description in a form text area, can now be saved
and shown in a form.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Access control | Opening a case no longer fails with an error when a permission condition checks the case's internal status and the case has no status yet |
| Case import | Importing a case type no longer fails when one of its building blocks already exists as final. |
| Dashboard | A long dashboard widget subtitle is now cut off with `...` instead of running out of the widget, the full title and subtitle show on hover, and the subtitle has more space between it and the chart. |
| Process editor | Expression fields in the BPMN editor now remember the Manual mode after saving, and chained expressions open in Manual mode instead of the Dropdown. |
| Widgets | A widget display condition with a number value, such as `0`, now compares numerically against a number field. The `${0}` workaround is no longer needed. |
| Case widgets | A process button on a widget respects access rules based on the case's status, instead of staying hidden while the same process could be started under **Start** |
