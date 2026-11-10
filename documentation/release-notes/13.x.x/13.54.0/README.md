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
| Case management | Actions hidden from the start menu stay hidden after creating a new version of the case type or changing the building block version of the action. |
| Dashboard | A long dashboard widget subtitle is now cut off with ellipsis instead of running out of the widget, and the full title and subtitle show on hover. |
| Dashboard | A bar chart widget with many categories no longer overflows its widget and overlaps other widgets. The legend now scrolls inside the widget. |
| Dashboard | A donut or bar chart widget with a long legend no longer shows two vertical scrollbars next to each other. |
| Forms | Disabled fields in forms now show their value in readable text, styled as read-only instead of faded grey. |
| OpenSearch document search | Case lists that use OpenSearch no longer come back empty when two case types store differently-typed values on the same field; each case type is now indexed separately. |
| OpenSearch document search | A full re-index no longer fails with `Limit of total fields [1000] has been exceeded` as the number of case types grows; each case type (and each of its schema versions) now has its own index, and the per-index field limit is configurable via `valtimo.opensearch.total-fields-limit` (default 5000). |
| OpenSearch document search | Large unsearchable blobs (such as `openzaakgegevens`) no longer inflate the index mapping or cause rejections when the same field holds an object in one case and a plain value in another; object content is now indexed as a single `flat_object` field whose nested values stay searchable. |
| OpenSearch document search | A field whose type changes between case-definition versions (e.g. a plain value in one version and an object in the next) no longer collides: each version is indexed separately and both remain searchable. |
| OpenSearch document search | A case deleted while an index rebuild is running is no longer resurrected when the rebuilt index is swapped in. |
| OpenSearch document search | While OpenSearch still holds a legacy/not-yet-migrated index, case-list searches fall back to the database so results are never incomplete; they return to OpenSearch automatically once the migrate re-index completes. |
| OpenSearch document search | A document that OpenSearch rejects during reconciliation is now retried on the next cycle instead of being skipped silently, and a rejected live-sync write is surfaced on the health endpoint. |

---

## Security

| Severity | Fix |
|----------|-----|
| High | The Objecten API plugin now validates object URLs more strictly and only accepts URLs that belong to the Objecten API it is configured with. If your Objecten API returns object URLs with a different host, port or path than the URL in the plugin configuration, update the plugin configuration to match, otherwise those objects can no longer be opened, changed or deleted. |
| High | The deprecated Documenten API endpoints for downloading, changing and deleting a document now check access more strictly. A document is only available through these endpoints when it is linked to a case the user can view. These endpoints will be removed in Valtimo 14. Use the endpoints that take the case as input instead. |
| High | Access checks on the documents of a case are stricter. Downloading, previewing, changing and deleting a document now also requires permission to view the case the document belongs to. |

---

## Migration

* **Existing OpenSearch installations must rebuild their index.** The topology is now one index per case type
  **and schema version**. After upgrading, the *Admin > OpenSearch* screen shows a banner until an operator runs
  a re-index with the **Rebuild / migrate index** option, which splits the data into the per-version indices.
  While the legacy index has not yet been migrated, case-list searches automatically fall back to the database, so
  results stay complete — they return to OpenSearch once the migrate re-index finishes. Run it promptly. If
  documents are skipped, resolve them and run the migration again. No data is lost, and changing search-field
  configuration does not trigger a rebuild.
* **Shard growth and automatic pruning (operational).** Because each case type now has its own index per schema
  version, clusters that accumulate many versions over time will hold more indices (roughly one shard each). To
  keep this in check, empty version indices — a version left with no documents — are pruned automatically during
  reconciliation, at most once per hour by default and never dropping a case type's last index (so its read alias
  survives); a later write of a pruned version re-creates its index on demand. Tune or disable this with
  `valtimo.opensearch.reconcile.prune-empty-version-indices` (default `true`) and
  `valtimo.opensearch.reconcile.prune-interval` (default `1h`).
