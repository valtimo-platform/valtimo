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
