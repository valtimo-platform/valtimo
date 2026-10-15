# 13.51.0

Release date: 21-10-2026

---

## New Features

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

---

## Migration

* **Cases menu on existing installations**

  The `enableGenericCaseList` feature toggle has been replaced by `showAllCaseDefinitionsInMenu`. When enabled, the
  Cases menu lists every case definition the user has access to, instead of only the case groups and case types the
  user pinned. Installations that were already started before this release have the toggle enabled during the
  upgrade, so the Cases menu keeps showing all case definitions. A value that was already set for the toggle is left
  unchanged. The toggle can be changed under *Settings > Feature toggles*.

  The old `enableGenericCaseList` toggle is removed, including any value stored for it. An `enableGenericCaseList`
  entry in the front-end environment configuration no longer has any effect.

---

## Deprecations

* The `GET /api/v1/internal-status` endpoint is deprecated and will be removed in a future release.
* The `assigneeFilter` property of the `POST /api/v1/document-search` request body is deprecated and will be removed
  in a future release.
