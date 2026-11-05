# 13.54.0

Release date: 11-11-2026

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
| OpenSearch document search | Case lists that use OpenSearch no longer come back empty when two case types store differently-typed values on the same field; each case type is now indexed separately (gzac-issues #924). |

---

## Migration

* **Existing OpenSearch installations must rebuild their index.** After upgrading, the *Admin > OpenSearch* screen
  shows a banner until an operator runs a re-index with the new **Rebuild / migrate index** option. Run it promptly —
  until it finishes, case lists can be incomplete. No data is lost, and changing search-field configuration no longer
  triggers a rebuild.
