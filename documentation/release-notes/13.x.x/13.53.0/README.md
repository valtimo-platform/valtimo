# 13.53.0

Release date: 04-11-2026

---

## New Features

### Case groups and Cases overview

Case definitions can now be combined into case groups. A case group has one shared case list with
its own list columns and search fields, mapped per case definition. Case groups are managed under
**Admin** > **Cases** > **Case groups** and can be exported and imported as a ZIP file.

The new Cases overview lists all case groups and case types a user has access to. Users pin the
items they use most, so these appear under **Cases** in the left sidebar. Case groups and case
definitions can have a color of their own.

The generic case list ("All cases") has been removed. Existing installations get the new feature
toggle **Show all case definitions in the menu** switched on during the upgrade, so the menu
keeps listing all case definitions.

More information: [Case groups](../../../configuration-guides/cases/case-groups/README.md).

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
| Process editor | Expression fields in the BPMN editor now remember the Manual mode after saving, and chained expressions open in Manual mode instead of the Dropdown. |
| Widgets | A widget display condition with a number value, such as `0`, now compares numerically against a number field. The `${0}` workaround is no longer needed. |
