# 13.51.0

Release date: 21-10-2026

---

## New Features

### Delete a document from a process

The Documenten API plugin has a new **Delete informatie object** action, so a process can delete a document straight from a service task by giving its URL. The same checks that already run when a document is deleted elsewhere in the application also run for this action.

### Building block references

Building block versions no longer have to be traced and updated by hand. The new **References** tab of a
building block version lists every case and building block that references it, with a link to the process
or actions tab where the reference is configured. **Update references**, on the building blocks list, opens a
wizard that moves those references onto another version — newer or older — of the same building block,
or onto another building block. See the [references documentation](../../../configuration-guides/building-blocks/references.md).

---

## Enhancements

### Currency field formatting

The **Currency** form field now formats amounts exactly as the configured locale writes them, including the position of
the currency symbol, the thousands and decimal separators, and negative amounts. For example, `nl-NL` shows
`€ 1.234,56` and `en-US` shows `$1,234.56`.

### New enhancement title

New enhancement explanation.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Area name | New bugfix. |
| Error responses | Error responses no longer include technical details such as stack traces for every client. Check that your own `valtimo.hardening.allowStacktraceOnIps` setting does not contain `*`. |
