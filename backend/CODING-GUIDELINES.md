# Backend coding guidelines

This document describes how code in `backend/` is generally written. It is meant as orientation for engineers familiar
with Spring Boot but new to this codebase, including external plugin authors. These are conventions, not hard rules —
when in doubt, match the surrounding code and ask in review.

Related:

- [`SECURITY.md`](../SECURITY.md) — responsible disclosure.
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — process and branching.

## License & file headers

Source files (`.java`, `.kt`, `.xml` changesets, `.gradle`, `.groovy`) carry the EUPL 1.2 copyright header. Copy it
verbatim from an existing file. Checkstyle enforces this for Java.

```java
/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * ...
 */
```

## Project layout

The backend is a Gradle multi-project. Each functional area lives in a top-level module under `backend/<module>/`.
Roughly:

- **Functional module** (`backend/<module>/`) — domain, services, controllers, repositories, Liquibase changesets, and
  the module's `@AutoConfiguration` class.
- **Contract module** (`backend/contract/`) — interfaces, annotations, DTOs, and constants that other modules consume.
- **App module** (`backend/app/gzac/`) — the runnable Spring Boot app for development.

Inside a module, packages are typically organised by feature:

```
com.ritense.<module>/
├── domain/
├── repository/
├── service/
├── web/
│   ├── rest/
│   └── rest/dto/
├── autoconfigure/    # or `config/`
└── importer/exporter/
```

Auto-configuration lives inside the functional module (not as a sibling Gradle subproject). Both `autoconfigure` and
`config` package names are in use.

### Generated frontend types

The frontend type generator scans `com.ritense.**.web.rest.dto.*` and emits TypeScript interfaces into
`@valtimo/shared`.
If you want a DTO to surface on the frontend, put it under `web.rest.dto`.

## Languages

Java 21 and Kotlin 2.1.20 are both in use. The codebase is gradually moving towards Kotlin, so new code tends to be
Kotlin, but Java is fine where it fits.

Common patterns you'll see:

- `data class` for DTOs.
- `val` over `var` where reassignment isn't needed.
- Constructor injection for Spring beans (no `@Autowired` on fields).
- `companion object` for constants.
- Checkstyle on the Java side; 4-space indent; no wildcard imports.

Coroutines are available but not pervasive — reach for them when there's a concrete async-IO benefit, and be aware that
Spring's transactional context doesn't propagate across `withContext`.

## Spring Boot

Spring Boot 3.5.x with Jakarta EE. Use `jakarta.*`, not `javax.*`.

Bean wiring goes in the module's `autoconfigure/` (or `config/`) package and is registered via
`META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`. Classes that should only be picked
up by explicit auto-configuration carry `@SkipComponentScan`.

### Example controller

```kotlin
@RestController
@SkipComponentScan
@RequestMapping("/api/v1/team")
class TeamResource(
    private val teamManagementService: TeamManagementService,
) {

    @GetMapping
    fun getAllTeams(
        @RequestParam(required = false) titleContains: String?,
        @SortDefaults(SortDefault(sort = ["title"])) pageable: Pageable,
    ): Page<TeamListResponseDto> =
        teamManagementService.findAll(titleContains, pageable).map { TeamListResponseDto.from(it) }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun createTeam(@Valid @RequestBody request: TeamCreateRequestDto): TeamResponseDto {
        val team = teamManagementService.create(Team(key = request.key, title = request.title))
        return TeamResponseDto.from(team)
    }
}
```

## REST controllers & DTOs

- Endpoints typically live under `/api/v1/...` for data-plane and `/api/management/v1/...` for management-plane.
- Resources are nouns; verbs are HTTP methods.
- DTOs live in `com.ritense.<module>.web.rest.dto.*` (so the frontend type generator picks them up).
- Naming convention: `*RequestDto`, `*ResponseDto`, `*ListResponseDto`.
- Map JPA entities to DTOs at the controller boundary rather than returning entities directly.

## Validation

`jakarta.validation` annotations on DTO fields. `@RequestBody` arguments are typically marked `@Valid` so Bean
Validation
actually runs. Custom validators worth knowing about live in `backend/contract/.../validation/` — for example `@Url` and
`@Bsn`.

## Security practices

A few rules that are not negotiable because of the data the platform handles (BSN, BRP, case content):

- Authentication is via Keycloak + Spring Security. Controllers don't parse tokens themselves.
- Authorization decisions go through the `backend/authorization/` module and the permission DSL where possible. Legacy
  `@PreAuthorize` is still around in older code.
- No secrets in source control. No secrets in logs.
- Don't log personal data, request/response bodies of personal-data endpoints, BSN, tokens, or raw query strings that
  may contain personal data. Logging case IDs, internal user UUIDs, and operation outcomes is fine.
- Use parameterised queries (JPQL/MyBatis bindings). Don't concatenate user input into SQL.
- For file uploads: validate content types, sanitise filenames, cap upload size, and resolve paths against a known base
  directory.

## Database & migrations

The platform runs on both **PostgreSQL** and **MySQL**, so Liquibase changesets need to work on both. CI runs the
integration-test suite against each.

- Changesets live under `src/main/resources/config/liquibase/<version>/<date>-<description>.xml`.
- Once a changeset is deployed, don't edit it — add a new one instead, otherwise Liquibase checksum validation fails on
  startup.
- `author="Ritense"` by convention.
- Use the `${uuidType}` token for UUID primary keys so it expands correctly per DB engine.

If a DTO field has `@Size(max = 255)`, the matching DB column should be at least `VARCHAR(255)`. Keep them in sync.

## Testing

JUnit 5 for both Java and Kotlin. Mockito + mockito-kotlin for mocking. AssertJ for assertions. Kotest is on the
classpath but barely used.

- Unit tests in `src/test/`, named `*Test`.
- Integration tests in `src/test/`, named `*IntTest`, extending the module's `BaseIntegrationTest`. Run with
  `./gradlew integrationTestingPostgresql` or `integrationTestingMysql`.
- Kotlin test names: backtick-quoted sentences (`` `should X when Y` ``).
- Controller slice tests use `@WebMvcTest` with `@MockitoBean`; reach for full `@SpringBootTest` only when needed.

`./gradlew testCodeCoverageReport` produces a JaCoCo report. There's no hard threshold — new code is expected to be
covered for both happy and error paths, but use judgement.

## Build & tooling commands

Run from the `backend/` directory:

| Command                                         | What it does                                   |
|-------------------------------------------------|------------------------------------------------|
| `./gradlew test`                                | Run unit tests in the current module           |
| `./gradlew testAll`                             | Run unit tests in every module                 |
| `./gradlew integrationTestingPostgresql`        | Integration tests, PostgreSQL                  |
| `./gradlew integrationTestingPostgresqlAll`     | Integration tests across all modules, Postgres |
| `./gradlew integrationTestingMysql`             | Integration tests, MySQL                       |
| `./gradlew check`                               | All checks including tests                     |
| `./gradlew :backend:app:gzac:bootRun`           | Start the dev app (requires services running)  |
| `./gradlew :backend:app:gzac:bootRunWithDocker` | Start the dev app with Docker services         |
| `./gradlew testCodeCoverageReport`              | JaCoCo coverage report                         |
| `./gradlew cleanAll`                            | Clean every module                             |

## Outbox & async

The platform uses the outbox pattern to publish domain events. When you mutate an aggregate, emitting an outbox event
lets downstream consumers (audit log, notifications, external integrations) react reliably.

Naming tends to be past-tense and factual: `CaseCreated`, `TaskAssigned`, `DocumentUploaded`. `*Viewed` events are used
for read-side audit logging of personal-data access. Events extend `BaseEvent` and use the CloudEvents spec for
transport.

For async work: `@Async` for fire-and-forget, `@Scheduled` + ShedLock for periodic jobs on multi-node deployments,
Spring Cloud Stream for RabbitMQ consumers.

## Reference: tool versions

Snapshot of versions from `gradle.properties` and `.java-version` — those files are authoritative.

| Tool                 | Version |
|----------------------|---------|
| Java                 | 21      |
| Kotlin               | 2.1.20  |
| Kotlin Coroutines    | 1.10.2  |
| Spring Boot          | 3.5.x   |
| JUnit                | 5.12.2  |
| Mockito-Kotlin       | 5.4.0   |
| Kotest (rarely used) | 5.9.1   |
| Liquibase            | 4.31.1  |
| Hibernate            | 6.6.x   |
| springDoc OpenAPI    | 2.8.6   |
