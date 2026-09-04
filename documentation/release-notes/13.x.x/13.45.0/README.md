# 13.45.0

Release date: 09-09-2026

---

## New Features

### New feature title

New feature explanation.

---

## Enhancements

### Suggested keys for list columns and search fields

When adding a list column or a search field, the key is now suggested based on the title you enter,
and remains yours to change with the pencil button.

### Activity IDs based on the activity name

In the process editor, an activity you draw now gets an ID based on the name, instead
of a generic one. Activities that already existed keep their ID, and once you edit an ID by hand
it stays exactly as you typed it. IDs are limited to 64 characters.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Case definitions | The version picker lists every version of a case again, instead of only the active one, and its pagination works |
| Case migration | The source and target version dropdowns offer every version of the selected case again, instead of only one |
| Plugins | The verzoek plugin offers every case version again when picking one, instead of only the active one |
| Case definitions | Versions are ordered by version number rather than alphabetically, so 1.0.10 comes after 1.0.9 |
