# OpenSearch

{% hint style="success" %}
Available since Valtimo 13.38.0
{% endhint %}

Valtimo can use OpenSearch as the search engine for case lists and document queries. OpenSearch provides faster full-text search and scales better than PostgreSQL for large volumes of cases.

{% hint style="info" %}
OpenSearch is optional. PostgreSQL search works out of the box and is sufficient for most deployments.
{% endhint %}

## When to use OpenSearch

Consider enabling OpenSearch when:
- You have a large number of documents (hundreds of thousands or more)
- Users need fast full-text search across document content
- Case list performance with complex filters becomes slow

For smaller deployments, PostgreSQL search is sufficient.

## Architecture

PostgreSQL remains the source of truth for all document data. OpenSearch acts as a derived read model that is kept in sync automatically:

1. **Live sync** — Document changes trigger events that update OpenSearch immediately after the transaction commits.
2. **Reconciliation** — A background job periodically scans for any missed changes and repairs the index.
3. **Full reindex** — Administrators can rebuild the entire index on demand when needed.

This architecture means:
- Writes always go to PostgreSQL first
- OpenSearch can be unavailable without data loss
- The system falls back to PostgreSQL automatically when OpenSearch is unreachable

## Dependencies

Add the case-opensearch module to your project. See [Case OpenSearch](../../fundamentals/getting-started/modules/core/case-opensearch.md) for Maven/Gradle dependencies.

## Configuration

### Infrastructure requirements

An OpenSearch 2.19.x instance is required. The connection is configured using Spring Data OpenSearch properties:

```yaml
spring:
  opensearch:
    uris: http://localhost:9200
    username: admin
    password: changeme
```

### Enabling the feature

The feature is disabled by default. Enable it in `application.yml`:

```yaml
valtimo:
  opensearch:
    enabled: true
```

When enabled, the application creates the document index on startup and begins syncing documents.

### Configuration properties

| Property | Default | Description |
|----------|---------|-------------|
| `valtimo.opensearch.enabled` | `false` | Master switch to enable OpenSearch for document queries |
| `valtimo.opensearch.healthCheckEnabled` | `true` | Enable periodic health checks of the OpenSearch connection |
| `valtimo.opensearch.healthCheckIntervalMs` | `30000` | Interval between health checks in milliseconds |
| `valtimo.opensearch.fallbackWarningIntervalMs` | `300000` | How often to log a warning when fallback to PostgreSQL is active |

### Reconciliation settings

The reconciler is a background job that keeps the index in sync by scanning for changes that the live event sync may have missed.

{% hint style="warning" %}
Duration properties use ISO 8601 duration format. Examples: `PT2M` = 2 minutes, `PT30S` = 30 seconds, `PT1H` = 1 hour.
{% endhint %}

| Property | Default | Description |
|----------|---------|-------------|
| `valtimo.opensearch.reconcile.enabled` | `true` | Enable the scheduled reconciliation job |
| `valtimo.opensearch.reconcile.interval` | `PT2M` | How often the reconciler runs |
| `valtimo.opensearch.reconcile.overlap` | `PT10S` | Safety margin for the watermark to catch in-flight transactions |
| `valtimo.opensearch.reconcile.pageSize` | `5000` | Number of documents to scan per database query |
| `valtimo.opensearch.reconcile.pendingDeletionBatchSize` | `500` | Batch size for cleaning up deleted documents |

### Reindex settings

These settings control the behavior of administrator-triggered full reindex operations.

| Property | Default | Description |
|----------|---------|-------------|
| `valtimo.opensearch.reindex.fallbackToPostgresWhileRunning` | `true` | Use PostgreSQL for queries while a reindex is in progress to avoid returning partial results |
| `valtimo.opensearch.reindex.runningHeartbeatTimeout` | `PT5M` | Consider a reindex run stale if no heartbeat is received within this duration |

### Fallback behavior

When OpenSearch becomes unavailable, the system automatically falls back to PostgreSQL for document queries. A warning is logged periodically (controlled by `fallbackWarningIntervalMs`). Once OpenSearch recovers, queries automatically switch back.

During a full reindex operation, queries fall back to PostgreSQL by default to avoid returning incomplete results. This can be disabled by setting `fallbackToPostgresWhileRunning: false` if you prefer faster queries over consistency during reindex.

### Example configuration

```yaml
valtimo:
  opensearch:
    enabled: true
    healthCheckEnabled: true
    healthCheckIntervalMs: 30000
    fallbackWarningIntervalMs: 300000
    reconcile:
      enabled: true
      interval: PT2M
      overlap: PT10S
      pageSize: 5000
      pendingDeletionBatchSize: 500
    reindex:
      fallbackToPostgresWhileRunning: true
      runningHeartbeatTimeout: PT5M

spring:
  opensearch:
    uris: http://opensearch:9200
```

## Admin API endpoints

All endpoints require the `ADMIN` authority.

### Search engine toggle

```http
GET /api/management/v1/search-engine
```

Returns the current search engine setting (`OPENSEARCH` or `POSTGRESQL`).

```http
PUT /api/management/v1/search-engine
Content-Type: application/json

{ "searchEngine": "OPENSEARCH" }
```

Switches the active search engine at runtime without restart.

### Reindex operations

```http
POST /api/management/v1/document-opensearch/reindex
Content-Type: application/json

{
  "documentDefinitionNames": ["loan-application", "permit-request"],
  "pruneBeforeReindex": false
}
```

Starts a full reindex. Parameters:
- `documentDefinitionNames` — Optional list of case definitions to reindex. If empty, all definitions are reindexed.
- `pruneBeforeReindex` — If `true`, deletes existing index entries before reindexing.

{% hint style="danger" %}
While a reindex runs, search results may be incomplete until the reindex finishes.
{% endhint %}

```http
GET /api/management/v1/document-opensearch/reindex/status
```

Returns the current reindex progress including documents processed and estimated completion.

```http
GET /api/management/v1/document-opensearch/reindex/runs
```

Returns the history of reindex runs with their status and duration.

## Customization

### Custom document fields

The indexed document includes standard fields like `definitionName`, `createdOn`, `assigneeFullName`, and a `contentText` field containing searchable text extracted from the entire document JSON.

To add custom indexed fields or modify the mapping, extend `JsonSchemaDocumentOsConverter` and register your implementation as a Spring bean.

### Custom sync behavior

Document changes are synced via `DocumentOpenSearchEventListener` which listens to document domain events. To customize sync behavior, you can register additional event listeners or extend the existing one.

## Access control

OpenSearch queries respect the same permissions as PostgreSQL queries. Documents are filtered based on the user's permissions for each case definition. No additional access control configuration is required.
