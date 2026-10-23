# 13.51.0

Release date: 21-10-2026

---

## New Features

### Delete a document from a process

The Documenten API plugin has a new **Delete informatie object** action, so a process can delete a document straight from a service task by giving its URL. The same checks that already run when a document is deleted elsewhere in the application also run for this action.

---

## Enhancements

### Currency field formatting

The **Currency** form field now formats amounts exactly as the configured locale writes them, including the position of
the currency symbol, the thousands and decimal separators, and negative amounts. For example, `nl-NL` shows
`€ 1.234,56` and `en-US` shows `$1,234.56`.

### Long texts in forms can be saved

A text of more than 4000 characters, such as a long description in a form text area, can now be saved
and shown in a form.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Tasks | A task opened from the task list filtered on a case type now shows its assigned team and user. |
| Error responses | Error responses no longer include technical details such as stack traces for every client. Check that your own `valtimo.hardening.allowStacktraceOnIps` setting does not contain `*`. |
