# 13.55.0

Release date: 18-11-2026

---

## New Features

### See and retry cases that OpenSearch could not index

The new **Rejected cases** tab on *Admin > OpenSearch* lists every case that OpenSearch could not
index, with its case definition, the number of attempts and the next automatic retry. After fixing
the cause, retry a single case with **Retry now** or every case with **Retry all**, instead of
waiting for the next automatic retry.

**[Try it out →](../../../configuration-guides/opensearch/README.md#rejected-cases)**

---

## Enhancements

### Rebuild the search index of one case definition without downtime

On *Admin > OpenSearch*, a reindex with **Rebuild / migrate index** now builds a fresh index and
switches over in one step, so case lists keep working while it runs. Choose a case definition to
rebuild only its index, or keep **All case definitions** to rebuild every index.

**[Try it out →](../../../configuration-guides/opensearch/README.md#starting-a-reindex)**

### Enabling OpenSearch indexes existing cases automatically

When you enable OpenSearch on an installation that already has cases, they are now indexed in the
background. Case lists keep using the database until that is done, so you no longer have to start a
reindex first.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Case search | A case that OpenSearch cannot index no longer disappears from its case list. |
| Case search | A field whose type changes between versions of a case definition no longer causes cases of the newer version to be skipped. |
| Case search | A full reindex no longer fails with `Limit of total fields [1000] has been exceeded` as the number of case definitions grows. |
| Case search | A reindex that skips cases now ends as *Completed with errors* and shows the number of skipped cases, instead of reporting success. |
| Case search | Case lists no longer come back empty when two case definitions store differently-typed values in the same field. |
| Case search | Large values, or a field that holds an object in one case and a plain value in another, no longer cause cases to be skipped. |



## Migration

{% hint style="warning" %}
The changes in this section are technical in nature and are intended for developers and operators
who deploy and maintain Valtimo and its OpenSearch cluster.
{% endhint %}

* **OpenSearch 2.7 or later is required.** Object content is indexed with the `flat_object` field
  type, which OpenSearch introduced in 2.7. Elasticsearch is not supported.
* **Migrate to the new index topology.** There is now one index per case definition version, so
  existing OpenSearch installations must rebuild their index once:
  1. Upgrade **all** application nodes first. A node still on the previous version keeps writing to
     the old shared index, so migrating before every node is upgraded leaves cases behind.
  2. On the *Admin > OpenSearch* screen, run a reindex with **Rebuild / migrate index** enabled. The
     screen shows a banner until you do. While the migration has not completed, case lists are
     served from the database, so results stay complete.
  3. If cases are skipped, the rebuilt indices are not published and the run explains why. Resolve
     the skipped cases and run the migration again.

  No data is lost, and changing search-field configuration does not trigger a rebuild.
* **Field limit per index.** `valtimo.opensearch.total-fields-limit` sets the maximum number of
  fields per index (default `5000`). It only applies to indices created after the change; run a
  reindex with **Rebuild / migrate index** to apply a new limit to existing indices.
* **Shard limit reached.** If OpenSearch reports `maximum shards open`, raise
  `cluster.max_shards_per_node` or remove unused indices. What happens until then depends on which
  index could not be created:
  * For an older version of a case definition, only the case lists of that case definition use the
    database. Its cases are listed as rejected and retried at growing intervals.
  * For the current version of a case definition, **all** case lists use the database and the
    *Admin > OpenSearch* screen shows *Index rebuild required*. A rebuild does not help here; the
    index is created automatically on the next reconciliation cycle once the limit allows it.

  After resolving the limit, use **Retry all** on the **Rejected cases** tab to index the affected
  cases right away instead of waiting for the next automatic retry.
* **Health status `WARN`.** The OpenSearch health indicator reports `WARN` when indices need a
  rebuild, existing cases are still being indexed, or cases were rejected or failed to index.
  Spring Boot leaves custom statuses out of the overall health unless they are listed in
  `management.endpoint.health.status.order`, for example `DOWN,OUT_OF_SERVICE,WARN,UP,UNKNOWN`.
