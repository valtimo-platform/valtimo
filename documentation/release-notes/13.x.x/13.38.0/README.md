# 13.38.0

{% hint style="info" %}
**Release date 22-07-2026**
{% endhint %}

## New Features

* **Global search**

  A new global search feature allows users to search across all cases from a single search field. Users can find cases
  by any text in their document content without knowing which specific field contains the information. Results are
  filtered by the user's permissions.

* **OpenSearch for document search**

  Case list search and global document queries can now use OpenSearch as the search engine instead of PostgreSQL.
  OpenSearch provides faster full-text search and scales better for large document volumes. The feature is opt-in
  and PostgreSQL remains the source of truth. OpenSearch acts as a derived read model that syncs automatically.
  See [OpenSearch search](../../../running-valtimo/application-configuration/opensearch.md) for setup instructions.

## Enhancements

## Bugfixes

* **Tag columns in task lists now display their content correctly**

  A task list column configured with the *Tags* view type now displays its tag content correctly. Previously the
  tag content was not shown properly for tag-type columns in task lists.


* **Documenten-api-file uploader loses uploaded file on redraw**

  Fixed an issue where a `documenten-api-file` uploader would lose its uploaded file when another
  uploader in the same form triggered a data change. This occurred when the affected uploader had
  `redrawOn: "data"` configured — a setting required for programmatically updating metadata fields
  such as the filename via `calculateValue`. On redraw, the Angular custom element was recreated
  with an empty value and the stored file references were never restored, causing the uploaded file
  to disappear from the UI.

* ZGW document actions such as **view** and **modify** could be incorrectly disabled for documents uploaded from a
  building block process.