# 13.55.0

Release date: 18-11-2026

---

## Bugfixes

| Area | Fix |
|------|-----|
| OpenSearch document search | Case lists that use OpenSearch no longer come back empty when two case types store differently-typed values on the same field; each case type is now indexed separately. |
| OpenSearch document search | A full re-index no longer fails with `Limit of total fields [1000] has been exceeded` as the number of case types grows; each case type (and each of its schema versions) now has its own index, and the per-index field limit is configurable via `valtimo.opensearch.total-fields-limit` (default 5000). |
| OpenSearch document search | Large unsearchable blobs (such as `openzaakgegevens`) no longer inflate the index mapping or cause rejections when the same field holds an object in one case and a plain value in another; object content is now indexed as a single `flat_object` field whose nested values stay searchable. Filters, sorting, global search and permissions on a field inside an object give the same results as the database, including number and date comparisons. A very long text value inside an object (such as an attached file) no longer causes the case to be skipped. |
| OpenSearch document search | A field whose type changes between case-definition versions (e.g. a plain value in one version and an object in the next) no longer collides: each version is indexed separately and both remain searchable. |
| OpenSearch document search | A case deleted while an index rebuild is running is no longer resurrected when the rebuilt index is swapped in. |
| OpenSearch document search | While OpenSearch still holds a legacy/not-yet-migrated index, case-list searches fall back to the database so results are never incomplete; they return to OpenSearch automatically once the migrate re-index completes. |
| OpenSearch document search | A case that OpenSearch refuses to index no longer disappears from its case list: the lists of that case type are served from the database until the case is indexed, the case is retried automatically at growing intervals (every 10 minutes at first, then hourly, then daily), and the health endpoint and the *Admin > OpenSearch* screen name the affected case types. One refused case no longer slows down indexing of all later changes. |
| OpenSearch document search | Case lists no longer come back empty when OpenSearch is enabled on an installation that already has cases: existing cases are indexed in the background and lists are served from the database until that is done. |
| OpenSearch document search | Search falls back to the database when OpenSearch cannot be reached, instead of every case list failing with an error. A case type without an index yet (for example a building block) returns an empty list instead of an error. |
| OpenSearch document search | A case whose case-definition version changes no longer appears twice in its case list. |

---

## Migration

* **OpenSearch 2.7 or later is required.** Object content is indexed with the `flat_object` field type, which
  OpenSearch introduced in 2.7. Elasticsearch is not supported.
* **Upgrade every application node before migrating.** Existing OpenSearch installations must rebuild their index:
  the topology is now one index per case type **and schema version**. After upgrading **all** nodes, run a re-index
  with the **Rebuild / migrate index** option on the *Admin > OpenSearch* screen; the screen shows a banner until
  you do. A node still on the previous version keeps writing to the old shared index, so migrating before every
  node is upgraded leaves cases behind. While the migration has not completed, case lists are served from the
  database, so results stay complete. If documents are skipped, the rebuilt indices are not published and the run
  explains why; resolve the skipped documents and run the migration again. No data is lost, and changing
  search-field configuration does not trigger a rebuild.
* **Enabling OpenSearch on an existing installation** no longer requires a manual re-index: existing cases are
  indexed in the background in batches, and case lists are served from the database until that has finished.
* **`valtimo.opensearch.total-fields-limit` only applies to indices created after the change.** Run a re-index with
  **Rebuild / migrate index** to apply a new limit to existing indices.
* **Shard growth and automatic pruning (operational).** Because each case type now has its own index per schema
  version, clusters that accumulate many versions over time hold more indices (one shard each). Empty indices of
  versions that are no longer current are pruned automatically during reconciliation, at most once per hour by
  default. The index of a case type's current version, and a case type's last index, are never pruned. Tune or
  disable this with `valtimo.opensearch.reconcile.prune-empty-version-indices` (default `true`) and
  `valtimo.opensearch.reconcile.prune-interval` (default `1h`). If OpenSearch reports `maximum shards open`, raise
  `cluster.max_shards_per_node` or remove unused indices; the affected cases are searched in the database
  meanwhile and indexed once the limit allows it.
* **Health status `WARN`.** The OpenSearch health indicator reports `WARN` while search falls back to the database.
  Spring Boot leaves custom statuses out of the overall health unless they are listed in
  `management.endpoint.health.status.order`, for example `DOWN,OUT_OF_SERVICE,WARN,UP,UNKNOWN`.
