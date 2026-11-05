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
| Dashboard | A long dashboard widget subtitle is now cut off with ellipsis instead of running out of the widget, and the full title and subtitle show on hover. |
| OpenSearch document search | Case lists that use OpenSearch no longer come back empty when two case types store differently-typed values on the same field; each case type is now indexed separately. |
| OpenSearch document search | A full re-index no longer fails with `Limit of total fields [1000] has been exceeded` as the number of case types grows; each case type now has its own index. |

---

## Migration

* **Existing OpenSearch installations must rebuild their index.** After upgrading, the *Admin > OpenSearch* screen
  shows a banner until an operator runs a re-index with the new **Rebuild / migrate index** option. Run it promptly —
  until it completes successfully, case lists can be incomplete. If documents are skipped, resolve them and run the
  migration again. No data is lost, and changing search-field configuration no longer triggers a rebuild.
