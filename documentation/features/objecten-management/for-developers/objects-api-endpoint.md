# Objects query endpoint

The Object Management Select component uses a dedicated endpoint to query objects from configured Object Management
configurations.

## Endpoint

```text
GET /api/v1/object-management/objects
```

## Query parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | One of id/title | Object Management configuration UUID |
| `title` | String | One of id/title | Object Management configuration title |
| `dataAttrs` | String | No | Comma-separated filter conditions |
| `page` | Integer | No | Page number (0-indexed, default: 0) |
| `size` | Integer | No | Page size (default: 20) |
| `sort` | String | No | Sort field and direction (e.g., `record__data__name,ASC`) |

{% hint style="warning" %}
Exactly one of `id` or `title` must be provided. Providing both or neither returns HTTP 400.
{% endhint %}

## Filter format (dataAttrs)

Filters are specified as comma-separated entries in the format: `attribute__comparator__value`

**Comparators accepted by the endpoint**:
- `exact` — Exact match
- `icontains` — Case-insensitive contains
- `gt` — Greater than
- `gte` — Greater than or equal
- `lt` — Less than
- `lte` — Less than or equal

{% hint style="info" %}
The Object Management Select component only ever emits `exact`, `icontains`, `gte`, and `lte`. The `gt` and `lt`
comparators are accepted by the endpoint but are not produced by the component builder. A column `range` search type
is a client-side convenience that is decomposed into a `gte`/`lte` pair before the request is sent; `range` itself is
not a valid endpoint comparator.
{% endhint %}

**Example**:
```text
dataAttrs=name__icontains__test,status__exact__active,createdAt__gte__2024-01-01
```

{% hint style="warning" %}
**Reserved delimiters.** The endpoint splits entries on `,` and splits each entry on `__`. The comparator is located
by scanning for a known comparator token, so nested attribute paths (e.g. `address__city__icontains__x`) are
supported. However, attribute segments and filter **values** must not contain a bare `,` or `__` — those characters
are reserved delimiters and would be mis-parsed. The Object Management Select component strips `,` and `__` from
free-text search values before building the query, so free-text search cannot match on those characters.
{% endhint %}

## Response

Returns a Spring `Page<ObjectWrapper>` with standard pagination metadata:

```json
{
  "content": [
    {
      "url": "https://objecten.api/objects/095be615...",
      "uuid": "095be615-a8ad-4c33-8e9c-c7612fbf6c9f",
      "type": "https://objecttypen.api/objecttypes/1",
      "record": {
        "index": 1,
        "typeVersion": 1,
        "data": {"name": "Example", "status": "active"},
        "startAt": "2024-01-01",
        "registrationAt": "2024-01-01"
      }
    }
  ],
  "totalElements": 42,
  "totalPages": 3,
  "number": 0,
  "size": 20
}
```

## Access control

When Permission Based Access Control (PBAC) is enabled (`valtimo.object-management.authorization.enabled=true`), the
endpoint checks both `view` and `view_list` permissions on the resolved Object Management configuration. If the user
lacks either permission, or the configuration is not found, an empty page is returned (HTTP 200, not 403). This
silent-denial behavior means the endpoint never reveals whether a configuration exists to a user without access.
