# API design standards

This page codifies the conventions for REST APIs exposed by Valtimo's backend. The conventions match what is already in
the codebase — they exist so that new endpoints stay consistent and so that contributors and partners know what to
expect.

## Scope

Applies to all `@RestController` classes under `backend/**/web/rest/`. Excludes:

- **Upstream ZGW APIs** consumed by Valtimo — those follow VNG specifications, not these conventions.
- **Spring actuator endpoints** (`/actuator/**`) — those follow Spring Boot conventions.
- **Server-Sent Event streams** — covered in a dedicated subsection below.

## URL conventions

### Base path

Two parallel namespaces exist:

```
/api/v<major>/<resource>              # data-plane (user-facing CRUD on cases, tasks, documents, …)
/api/management/v<major>/<resource>   # management-plane (admin / configuration endpoints)
```

The split is by **audience and authorization**, not by version. `/api/management/v1` carries
administrative endpoints — role and permission management, admin settings, building-block
configuration, IKO management, etc. — and has its own `HttpSecurityConfigurer` per module (see
e.g. `AdminSettingsHttpSecurityConfigurer`, `ValtimoAuthorizationHttpSecurityConfigurer`,
`BuildingBlockHttpSecurityConfigurer`). Use `/api/management/v1` for endpoints that only an
operator or admin role should reach; use `/api/v1` for endpoints that a regular case-handler
uses.

The major version is currently `v1` for both namespaces. `/api/v2` and `/api/management/v2` will
be introduced only when a breaking change to an existing endpoint is unavoidable; see
[Versioning](#versioning). The version is bumped per namespace independently — a breaking
change in the data plane does not force a bump in the management plane, and vice versa.

### Resource names

- **kebab-case.** `/api/v1/case-definitions`, not `/api/v1/caseDefinitions`.
- **Plural for collections, singular for single-aggregate endpoints.**
    - `GET /api/v1/case-definitions` — collection.
    - `GET /api/v1/case/{id}` — single aggregate by ID.
- **Nested resources** model containment: `/api/v1/team/{teamKey}/user/{username}`.

### Class-level mapping

Put the full base path (including `/api/v1` or `/api/management/v1`) on the class-level
`@RequestMapping`. Method-level mappings only add sub-paths. **Do not** split the namespace prefix
from `/<resource>` across class and methods — that pattern exists in legacy code but is
inconsistent and harder to grep for.

```kotlin
@RestController
@RequestMapping("/api/v1/team")   // good — full base path on the class
class TeamResource {
  @GetMapping                   // resolves to /api/v1/team
  fun getAllTeams(): Page<TeamListResponseDto> { /* ... */
  }
}
```

## HTTP methods

| Method   | Semantics                                                                                  |
|----------|--------------------------------------------------------------------------------------------|
| `GET`    | Safe, idempotent. Never has a request body. Returns `200 OK` or `404 Not Found`.           |
| `POST`   | Create or non-idempotent action. Returns `201 Created` with a `Location` header on create. |
| `PUT`    | Full replacement of a resource. Idempotent. Returns `200 OK` or `204 No Content`.          |
| `PATCH`  | Partial update. **JSON Merge Patch (RFC 7396)** by default — see below.                    |
| `DELETE` | Remove a resource. Returns `204 No Content`. Idempotent.                                   |

### PATCH semantics

Default to **JSON Merge Patch (RFC 7396)**: the request body is a partial document where present fields replace the
current values and `null` clears a field. JSON Patch (RFC 6902, the `[{ op, path, value }]` array shape) is allowed only
when the endpoint documentation calls it out explicitly.

### POST for searches

Complex query predicates that don't fit in URL query parameters use `POST /<resource>/search` with the predicate in the
body. This is the precedent set by `process-document/tasksearch` and `SearchRequestValidator`. The endpoint is
idempotent in spirit but uses `POST` because of body size and structure.

## Status codes

| Code  | When to use                                                                                  |
|-------|----------------------------------------------------------------------------------------------|
| `200` | Successful `GET`, `PUT`, `POST` (when the response has a body and it isn't a creation).      |
| `201` | Resource created via `POST`. Include a `Location` header pointing to the new resource.       |
| `204` | Successful operation with no response body (`DELETE`, `PUT` that doesn't echo).              |
| `400` | Request is malformed (bad JSON, missing required field). RFC 7807 body.                      |
| `401` | Caller is not authenticated.                                                                 |
| `403` | Caller is authenticated but not authorized for this resource or action.                      |
| `404` | The requested resource does not exist (or the caller is not allowed to know it does).        |
| `409` | The request conflicts with the current state (e.g. unique-key violation, optimistic-lock).   |
| `422` | The request is well-formed but semantically invalid (validation failure on referenced data). |
| `500` | Unexpected server error. The body is RFC 7807; no stack trace is returned.                   |

Bean Validation failures on `@RequestBody @Valid` return `400` by default (translated by Zalando's `ProblemHandling`).
Reserve `422` for cross-field rules that fire after structural validation.

## Versioning

### Strategy

**Major-version-in-path.** `/api/v1`, `/api/v2`, and equivalently `/api/management/v1`,
`/api/management/v2`. No header-based versioning, no `Accept: application/vnd.valtimo.v2+json`.
The path is the API's contract; URLs are stable across the lifetime of a major version. Each
namespace versions independently.

### What goes in the same major version

Backwards-compatible changes stay in `v1`:

- Adding a new optional field to a request or response.
- Adding a new endpoint.
- Returning a richer response in a way that does not change the existing schema.
- Returning a new status code only for a previously-unhandled error path (i.e. callers were getting `500` and now get
  `400`).

### What forces a new major version

Breaking changes require `/api/v2`:

- Removing or renaming a field on a request or response.
- Changing the semantics of an existing field (e.g. units, encoding).
- Changing a status code returned for an existing scenario in a way callers must adapt to.
- Tightening validation in a way that rejects payloads that were previously accepted.

When a new major (`/api/v2` or `/api/management/v2`) is introduced, the corresponding `v1` endpoint in the same
namespace follows the [deprecation policy](deprecation-policy.md): announce, mark with the deprecation headers, and
remove on the schedule defined there.

## Pagination

Use Spring's `Pageable` argument resolver and return `Page<T>`:

```kotlin
@GetMapping
fun getAllTeams(
    @RequestParam(required = false) titleContains: String?,
    @SortDefaults(SortDefault(sort = ["title"])) pageable: Pageable,
): Page<TeamListResponseDto> = /* ... */
```

Query parameters (Spring defaults):

- `page` — zero-indexed page number.
- `size` — page size.
- `sort` — `field,direction`, repeatable. Example: `?sort=title,asc&sort=createdOn,desc`.

The maximum page size is capped globally via `spring.data.web.pageable.max-page-size`. Endpoints should not override the
cap without justification.

## Filtering & search

- **Simple equality:** query parameters. `GET /api/v1/team?titleContains=foo`.
- **Complex predicates:** `POST /<resource>/search` with the predicate in the body. The body is a DTO, validated like
  any other; predicates are translated to Criteria/QueryDSL, never to a SQL string.
- **Never** accept a free-form `q` parameter that maps to arbitrary backend fields — that is a search-injection vector
  and a stable-API hazard.

## Error format — RFC 7807 Problem Details

Errors are returned as **`application/problem+json`** per RFC 7807. The format is implemented in
`com.ritense.valtimo.contract.web.rest.error.ExceptionTranslator` (`backend/contract/`) via
Zalando's `ProblemHandling`. Every `@RestController` inherits this behaviour automatically — do not catch and re-format
exceptions inside controllers.

### Response shape

```json
{
    "type": "/problem-with-message",
    "title": "Bad Request",
    "status": 400,
    "detail": "Title must not be blank.",
    "instance": "https://valtimo.example/api/v1/team",
    "path": "/api/v1/team",
    "message": "error.validation",
    "errors": [
        "title: must not be blank"
    ]
}
```

| Field      | Source            | Notes                                                                |
|------------|-------------------|----------------------------------------------------------------------|
| `type`     | RFC 7807          | Defaults to `/problem-with-message` (`ErrorConstants.DEFAULT_TYPE`). |
| `title`    | RFC 7807          | Short human-readable summary.                                        |
| `status`   | RFC 7807          | HTTP status as an integer.                                           |
| `detail`   | RFC 7807          | Optional. Specific cause for this occurrence.                        |
| `instance` | RFC 7807          | Optional. URI identifying the specific occurrence.                   |
| `path`     | Valtimo extension | The request path; added by `ExceptionTranslator`.                    |
| `message`  | Valtimo extension | i18n key for the frontend toast (e.g. `error.validation`).           |
| `errors`   | Valtimo extension | Validation failures, one entry per violated constraint.              |

The `message` extension exists so the frontend can localise the error without parsing the server's English copy. Keys
live in `frontend/projects/valtimo/.../i18n/`.

### Rules

- **All 4xx and 5xx responses use this format.** No raw text, no ad-hoc JSON.
- **Never leak stack traces, internal class names, or database error strings.** The `HardeningService` (active in
  production) strips these. In development the full detail is visible — don't rely on that in your own controllers.
- **One `Problem` per response.** Do not return an array of problems.

See also the backend coding guidelines section on [Validation](../../backend/CODING-GUIDELINES.md#validation).

## Authentication & authorization

- **Bearer tokens.** Keycloak-issued JWTs in the `Authorization: Bearer <jwt>` header.
- **Never accept API keys in query strings.** Query strings appear in server logs, browser history, and proxy logs.
- **CORS** is configured via the properties documented in [
  `documentation/running-valtimo/application-configuration/valtimo-cors.md`](../running-valtimo/application-configuration/valtimo-cors.md).
- **Content Security Policy** is configured via [
  `documentation/running-valtimo/application-configuration/content-security-policy.md`](../running-valtimo/application-configuration/content-security-policy.md).
- **Authorization decisions** go through the platform's authorization module — never hand-roll role checks in a
  controller.
  See [backend coding guidelines § Security practices](../../backend/CODING-GUIDELINES.md#security-practices).

## Content types

- **Default:** `application/json; charset=UTF-8`. The codebase uses the constant `APPLICATION_JSON_UTF8_VALUE` — prefer
  it over the bare string.
- **File uploads:** `multipart/form-data`. Apply the file-handling rules from
  the [backend coding guidelines § Security practices](../../backend/CODING-GUIDELINES.md#security-practices) —
  whitelist content types, sanitise filenames, cap size.
- **Errors:** `application/problem+json` (see above).
- **Server-Sent Events:** `text/event-stream`. SSE endpoints stream `data:` lines; no JSON framing, no chunked-binary
  tricks. Use `ResponseBodyEmitter` / `SseEmitter` and document the event types in the OpenAPI operation summary.

## OpenAPI

springDoc 2.8.6 is on the classpath via `backend/web/build.gradle:54`. Every controller contributes to the generated
OpenAPI spec automatically.

### Per-endpoint requirements

`@Operation` annotations are **not yet used in the codebase** — adopting them is part of this standard. New endpoints
should declare:

- A `summary` (`@Operation(summary = "...")`) — one sentence in plain English.
- An `operationId` (auto-derived if omitted, but better named explicitly).
- Response schemas via `@ApiResponse` when the success or error response is non-default.

Existing endpoints do not need to be retrofitted in one go; add the annotations when you touch the endpoint for another
reason.

```kotlin
@Operation(
    summary = "Create a team",
    operationId = "createTeam",
)
@ApiResponse(responseCode = "201", description = "Team created.")
@ApiResponse(responseCode = "400", description = "Validation failed.")
@PostMapping
@ResponseStatus(HttpStatus.CREATED)
fun createTeam(@Valid @RequestBody request: TeamCreateRequestDto): TeamResponseDto = /* ... */
```

### Publishing

The default springDoc UI is exposed in development and test environments at `/v3/api-docs` and `/swagger-ui.html`. In
production deployments, the operator may disable the endpoint via `springdoc.api-docs.enabled=false`. The spec is not
committed to the repository — it is generated from source.

## Naming

### DTO suffixes

- `*RequestDto` — inbound (request body, query DTO).
- `*ResponseDto` — outbound (response body for a single aggregate).
- `*ListResponseDto` — outbound for a list row, when the list shape differs from the detail shape.
- Avoid plain `*Dto` — the role is ambiguous and grep-hostile.

### Field names

- **camelCase** in JSON. Spring/Jackson defaults match this.
- **Snake-case** is reserved for upstream ZGW interop layers and must not appear in Valtimo-defined endpoints.
- **Avoid Hungarian notation.** `userId` not `strUserId`; `enabled` not `bEnabled`.
- **Booleans read as predicates.** `enabled`, `archived`, `hasUnreadMessages`. Don't prefix with `is` in the JSON body —
  Jackson handles the `isEnabled` ↔ `enabled` mapping for record/Lombok accessors but the wire field is `enabled`.

## Deprecating endpoints

REST endpoints are part of the public API surface and follow the [deprecation policy](deprecation-policy.md). When
deprecating an endpoint:

1. Mark the controller method as deprecated — Kotlin:
   `@Deprecated("Use /api/v2/<resource> instead", ReplaceWith("..."))`; Java:
   `@Deprecated(since = "13.N", forRemoval = true)` plus a Javadoc `@deprecated` tag.
2. Add the **`Deprecation`** HTTP response header (RFC draft) on every response from the deprecated endpoint — a date or
   `true`.
3. Add the **`Sunset`** HTTP response header (RFC 8594) with the planned removal date.
4. Mark the OpenAPI operation as deprecated (`@Operation(deprecated = true)`).
5. Add the entry to `## Deprecations` in the release notes for the version that announces it.

```kotlin
@Deprecated("Use /api/v2/team instead", ReplaceWith("getAllTeamsV2(...)"))
@Operation(summary = "List teams (deprecated)", deprecated = true)
@GetMapping
fun getAllTeams(/* ... */): Page<TeamListResponseDto> {
    response.setHeader("Deprecation", "true")
    response.setHeader("Sunset", "Wed, 11 Nov 2026 23:59:59 GMT")
    return /* ... */
}
```

## Cross-references

- [Backend coding guidelines](../../backend/CODING-GUIDELINES.md) — how to write the controller and DTO classes that
  implement these standards.
- [Deprecation policy](deprecation-policy.md) — how to retire an endpoint.
- [Frontend coding guidelines § Generated backend types](../../frontend/CODING-GUIDELINES.md#generated-backend-types) —
  why DTOs must live in `com.ritense.**.web.rest.dto.*`.

---

**Last reviewed:** 2026-06-09. Update this page whenever a new convention is introduced or an existing one changes (e.g.
when `/api/v2` lands, when the OpenAPI publishing policy changes).
