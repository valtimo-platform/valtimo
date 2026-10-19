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
  After upgrading, run the document-search re-index from *Admin > Search* so the per-definition indices are created
  and populated from the database. Until the re-index completes, document search keeps serving results from the
  legacy index. Editing search-field configuration no longer triggers an index rebuild.
