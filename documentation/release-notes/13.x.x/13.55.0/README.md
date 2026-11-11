# 13.55.0

Release date: 18-11-2026

---

## Enhancements

### Rebuild the search index of one case type without downtime

On *Admin > OpenSearch*, a re-index with **Rebuild / migrate index** now builds a fresh index and switches over in one step, so case lists keep working while it runs. Choose a case type to rebuild only its index, or none to rebuild all of them. A rebuild that could not index every case is not switched over, and the run tells you why.

### See and retry cases that OpenSearch could not index

*Admin > OpenSearch* now lists the cases that OpenSearch refused to index. For each case it shows the case type, how often indexing was tried and when it is tried next. Use **Retry now** after fixing the cause, or **Retry all** to retry every case on the next indexing round.

### Enabling OpenSearch indexes existing cases automatically

When you enable OpenSearch on an installation that already has cases, they are now indexed in the background. Case lists keep using the database until that is done, so you no longer have to start a re-index first.

---

## Bugfixes

| Area | Fix |
|------|-----|
| OpenSearch document search | Case lists no longer come back empty when two case types store differently-typed values in the same field. |
| OpenSearch document search | A full re-index no longer fails with `Limit of total fields [1000] has been exceeded` as the number of case types grows. The field limit per index is configurable via `valtimo.opensearch.total-fields-limit` (default 5000). |
| OpenSearch document search | A re-index that skips cases now ends as *Completed with errors* and shows the number of skipped cases, instead of reporting success. |
| OpenSearch document search | Large values such as `openzaakgegevens`, or a field that holds an object in one case and a plain value in another, no longer cause cases to be skipped. |
| OpenSearch document search | A field whose type changes between versions of a case type no longer causes cases of the newer version to be skipped. |
| OpenSearch document search | A case that OpenSearch cannot index no longer disappears from its case list. The case type's lists use the database until the case is indexed, and indexing is retried automatically at growing intervals. |

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
