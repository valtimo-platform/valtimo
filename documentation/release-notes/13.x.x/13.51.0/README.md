# 13.51.0

Release date: 21-10-2026

---

## New Features

### New feature title

New feature explanation.

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
| Process editor | Expression fields in the BPMN editor now remember the Manual mode after saving, and chained expressions open in Manual mode instead of the Dropdown. |
