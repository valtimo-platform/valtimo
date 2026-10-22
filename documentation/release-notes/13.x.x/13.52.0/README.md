# 13.52.0

Release date: TBD

---

## Bugfixes

| Area | Fix |
|------|-----|
| OpenSearch document search | Case documents are now indexed into one OpenSearch index per case definition instead of a single shared `json_schema_document` index. Previously, when two case types put differently-typed values on the same content path (for example `content.locatie` as free text in one case type and as a GeoJSON object in another), the second document was rejected with a `mapper_parsing_exception`, silently dropped, and that case type's list came back empty (gzac-issues #924). Per-definition indices give each case type its own mapping namespace, so these cross-definition type collisions can no longer occur and the case lists populate correctly. A shared read alias (`json_schema_document_all`) serves the cross-definition "All cases" list. |

---

## Migration

* **Existing OpenSearch installations must rebuild their index**

  Installations that already use OpenSearch for document search hold a single legacy `json_schema_document` index.
  After upgrading, the *Admin > OpenSearch* screen shows a warning banner while the topology is still legacy or stale
  (the `/actuator/health` endpoint reports the same via a non-fatal `WARN` status). Start a re-index with the new
  **Rebuild / migrate index** option enabled to create and populate the per-definition indices from the database and
  drop the legacy index. Until the migration completes, document search keeps serving results from the legacy index —
  the migration never drops it on startup. Editing search-field configuration no longer triggers an index rebuild.

  The same **Rebuild / migrate index** option, combined with a document-definition filter, rebuilds a single
  definition's index zero-downtime: the documents are reindexed into a fresh index and the shared read alias is
  swapped onto it atomically, so case lists never see a gap.
