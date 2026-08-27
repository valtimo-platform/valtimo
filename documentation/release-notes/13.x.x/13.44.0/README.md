# 13.44.0

Release date: 02-09-2026

---

## New Features

### New feature title

New feature explanation.

---

## Enhancements

### Clearing a case field follows the case model

Emptying a field now follows what the case model allows: the field is either set to empty or removed, and a field the model requires is refused instead of silently leaving the case invalid.

### Searchable building block overview

The building block overview is now sorted by name, paginated, and searchable by name or key, so a large collection of building blocks stays workable.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Cases | The process selector on the Progress tab shows long process names in full instead of cutting them off |
| Cases | The progress tab shows the name of every process, instead of leaving some blank |
| Plugins | Required fields such as the authentication configuration have to be filled in before a plugin configuration can be saved |
| Case configuration | A field path the case model does not allow is rejected instead of accepted |
| Field pickers | A case model with an unreadable reference no longer stops every field picker from loading |
| Field pickers | Lists in a case can be picked as a field, not only as a collection |
| Building blocks | Selecting a field for a mapping works again when the document schema refers to itself |
| Process links | Changing the building block version keeps the configuration that still applies to the new version |
