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

---

## Bugfixes

| Area | Fix |
|------|-----|
| Case definitions | A new draft based on an existing version of a case with building blocks can be created again |
| Case definitions | Creating a draft from a version with unresolved configuration issues is refused with an explanation, instead of failing with a server error |
| Cases | The process selector on the Progress tab shows long process names in full instead of cutting them off |
| Cases | The progress tab shows the name of every process, instead of leaving some blank |
| Plugins | Required fields such as the authentication configuration have to be filled in before a plugin configuration can be saved |
| Case configuration | A field path the case model does not allow is rejected instead of accepted |
| Field pickers | A case model with an unreadable reference no longer stops every field picker from loading |
| Field pickers | Lists in a case can be picked as a field, not only as a collection |
