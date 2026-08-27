# 13.44.0

Release date: 02-09-2026

---

## New Features

### New feature title

New feature explanation.

---

## Enhancements

### Faster document handling

Document schemas are now parsed once and reused instead of on every use, and process links are indexed on
their process definition. Creating and updating cases, resolving document values and opening task forms are
all faster, most noticeably on configurations with large document schemas or many process links.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Cases | The process selector on the Progress tab shows long process names in full instead of cutting them off |
| Plugins | Required fields such as the authentication configuration have to be filled in before a plugin configuration can be saved |
