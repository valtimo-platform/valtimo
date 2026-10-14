# 13.50.0

Release date: 14-10-2026

{% hint style="warning" %}
This release contains security fixes. See [Security](#security) for details.
{% endhint %}

---

## New Features

### Side panel

A new side panel at the right edge of the screen shows supporting content next to the page the user is working on. The page moves aside to make room; on small screens the panel overlays the page instead.

- On a case's detail page, the side panel shows the tasks of the case. Task forms and start forms with the **Panel** form display type open in the side panel. The tasks button in the case header shows or hides the panel.
- A form open in the panel stays open when switching between case tabs. Leaving the case with unsaved changes in a form asks for confirmation first.
- External plugins can offer their own content to the side panel. The panel header names the case the content belongs to and links back to it.
- Users resize the panel by dragging its left edge. The width is remembered.
- The case header actions adapt to the available width, collapsing to icon-only buttons when space runs out.

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
| Area name | New bugfix. |
| Processes | A text of more than 4000 characters, such as a long description in a form text area, can be saved and shown in a form again instead of causing an error |

---

## Security

| Severity | Fix |
|----------|-----|
| Medium | The dropdown list and translation data endpoints no longer let a logged-in user read JSON files outside the `config/dropdown` and `config/translation` folders, such as plugin configurations or permission files, by putting `../` in the requested key |
| Medium | The case widget endpoints (widget tab, widget data and grouped widget data) now require `view` permission on the case itself (`JsonSchemaDocument`), in addition to the case tab and widget permissions. |
| Medium | The zaak endpoints, zaak files endpoints, the zaak object endpoints, the external plugin tab, the case tabs of a case, the process links of a case and the process timer endpoints now require `view` permission on the case. |
| Medium | Several process-related endpoints now have additional access control. The process diagram shown in the case **Progress** tab and in **Case Inspection** now requires permission on the case |
