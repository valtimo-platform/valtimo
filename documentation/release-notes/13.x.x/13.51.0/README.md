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

### Stop the other processes of a case and carry on

A process can now stop all other running processes of its case and then continue its own flow, so a rejection can clear the remaining work and still set a status or send a letter. It sits in the expression dropdown in the BPMN modeler next to the existing option, which stops every process of the case including the calling process.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Area name | New bugfix. |
| Error responses | Error responses no longer include technical details such as stack traces for every client. Check that your own `valtimo.hardening.allowStacktraceOnIps` setting does not contain `*`. |
