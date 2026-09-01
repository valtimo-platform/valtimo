# 13.44.0

Release date: 02-09-2026

---

## New Features

### Visual form flow editor (beta)

Form flows can now be built visually instead of by hand-writing JSON. A new **Editor (beta)**
tab sits beside the existing **JSON editor** tab — both work on the same definition, so you can
switch at any time. The visual editor lists the flow's steps in a sidebar and, per step, lets
you set the key, title, type, start step, transitions (with their SpEL conditions and order),
and the actions that run on open, complete, or back. It validates the definition as you edit
and warns about unsaved changes. See the
[form flow documentation](../../../configuration-guides/cases/form-flows.md#editing-in-the-visual-editor-beta)
for details.

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

### Faster document handling

Creating and updating cases, resolving document values and opening task forms are all faster, most
noticeably on configurations with large document schemas or many process links.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Admin screens | Dropdown lists open in the right place, instead of on top of their own search box |
| Admin screens | Field pickers no longer come up empty when more than one is shown on a screen |
| Case configuration | A field path the case model does not allow is rejected instead of accepted |
| Case definitions | A new draft based on an existing version of a case with building blocks can be created again |
| Case management | A process in a finalised case version shows all of its settings, read-only, instead of only the process link |
| Case search | Permissions based on case status or tags now filter OpenSearch search results |
| Cases | The process selector on the Progress tab shows long process names in full instead of cutting them off |
| Cases | The progress tab shows the name of every process, instead of leaving some blank |
| List columns | The **Path** field is empty again when the column modal is reopened after cancelling |
| Documenten API | A file uploaded with the Documenten API upload field on a form is added to the case, also when that form belongs to a building block |
| Process links | Every version of a building block is offered when picking one |
| Plugins | Re-saving a plugin configuration removes settings from older versions that are no longer used |
| Plugins | Required fields such as the authentication configuration have to be filled in before a plugin configuration can be saved |
| Process links | Changing the form flow definition on an existing form flow process link is now saved (previously the change was silently ignored). |
| Field pickers | A case model with an unreadable reference no longer stops every field picker from loading |
| Field pickers | Lists in a case can be picked as a field, not only as a collection |
