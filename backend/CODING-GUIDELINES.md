# Backend coding guidelines

This document describes the conventions for code in `backend/`. It is intended for engineers who are familiar with
Spring Boot but new to this codebase, including external plugin authors. Match the depth and tone of [
`frontend/CODING-GUIDELINES.md`](../frontend/CODING-GUIDELINES.md).

Related docs:

- [API design standards](../documentation/contributing-to-valtimo/api-design-standards.md) — REST conventions, error
  format, versioning.
- [Deprecation policy](../documentation/contributing-to-valtimo/deprecation-policy.md) — how to retire public surface.
- [Data processing guidelines](../documentation/contributing-to-valtimo/data-processing-guidelines.md) — what to store,
  what not to log.
- [`SECURITY.md`](../SECURITY.md) — responsible disclosure.
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — process and branching.

## License & file headers

Every source file (`.java`, `.kt`, `.xml` changesets, `.gradle`, `.groovy`) must include the EUPL 1.2 copyright header.
Copy the header verbatim from an existing file — the year range is updated when a file is materially changed. Files
without the header are rejected by Checkstyle for Java; Kotlin files are checked manually in review.

```java
/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * ...
 */
```

## Project layout & module pattern

The backend is a Gradle multi-project. Each functional area lives in a top-level module under `backend/<module>/`. The
convention is:

- **Functional module** (`backend/<module>/`) — domain, services, controllers, repositories, Liquibase changesets,
  **and** the module's `@AutoConfiguration` class. No `@SpringBootApplication`, no `@EnableAutoConfiguration` (those
  belong
  to the app module).
- **Contract module** (`backend/contract/`) — interfaces, annotations, DTOs, and constants that other modules consume.
  Keep it dependency-light.
- **App module** (`backend/app/gzac/`) — the runnable Spring Boot app for development. The only place with
  `@SpringBootApplication`.

Inside a module, organise packages by feature, not by layer:

```
com.ritense.<module>/
├── domain/            # JPA entities, value objects
├── repository/        # Spring Data repositories
├── service/           # Business logic
├── web/
│   ├── rest/          # @RestController classes
│   └── rest/dto/      # Request/response DTOs (see "Generated frontend types" below)
├── autoconfigure/     # or `config/` — the @AutoConfiguration class, bean wiring,
│                      #   @ConditionalOnProperty flags. Registered via
│                      #   META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
└── importer/exporter/ # If the module participates in import/export
```

Auto-configuration **lives inside the functional module** (sibling package, not a sibling Gradle project). Two existing
conventions for the package name are in use: `autoconfigure` (e.g. `com.ritense.iko.autoconfigure`) and `config` (e.g.
`com.ritense.outbox.config`). New modules may pick either; do not split the auto-configuration into a separate Gradle
subproject.

### Generated frontend types

The frontend type generator scans `com.ritense.**.web.rest.dto.*` and emits TypeScript interfaces into
`@valtimo/shared`. **DTOs must live under `web.rest.dto`** for this to work. See the frontend guidelines section
"Generated backend types" for the consumer side.

## Kotlin style

Kotlin is preferred over Java for new code. The codebase uses Kotlin 2.1.20 with coroutines 1.10.2
(see `gradle.properties`).

### Defaults

- **Data classes for DTOs.** Use `data class` for request/response bodies — equality and `copy()` come for free.
- **`val` over `var`.** Default to immutable references. Use `var` only when reassignment is semantically required.
- **`lateinit` only for Spring-injected fields** that cannot be set in the constructor (e.g. fields on a base test
  class). Constructor injection is the default in this codebase.
- **`companion object` for constants.** Put `const val` static-style constants here. Top-level declarations are fine for
  cross-class utilities.
- **Top-level functions** are acceptable for utilities (e.g. extension functions on framework types). For domain logic,
  prefer methods on a class.

### Example DTO

```kotlin
package com.ritense.team.web.rest.dto

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Size

data class TeamCreateRequestDto(
    @field:NotBlank
    @field:Size(max = 255)
    @field:Pattern(regexp = "[a-z0-9_-]+")
    val key: String,

    @field:NotBlank
    @field:Size(max = 255)
    val title: String
)
```

### Coroutines

Coroutines are available but not pervasive in this codebase. Reach for them only when there is a concrete async-IO
benefit (e.g. orchestrating multiple HTTP calls). Rules:

- **No `GlobalScope`.** Always launch coroutines from an injected scope (`CoroutineScope`) with a defined parent and
  `Dispatchers.IO` (or `Default`) selected explicitly.
- **Don't mix blocking and suspending.** If a service has suspending functions, callers above it should also be
  suspending; do not `runBlocking` inside a Spring `@Transactional` method.
- **Spring's transactional context does not propagate across coroutine context switches.** If you cross `withContext`,
  you leave the transaction.

## Java style

Java 21 is the target (see `.java-version`). The codebase is moving from Java to Kotlin; new classes should be Kotlin
unless there is a compelling reason. When writing Java:

- **Checkstyle** is enforced. The ruleset is `ritense_valtimo_only_checks.xml` (fetched from
  `${ritenseCheckStyleLocation}` in `gradle.properties`). The build fails on violations.
- **Indentation:** 4 spaces, no tabs (see `backend/.editorconfig`).
- **Brace style:** `end_of_line` (K&R) for blocks; opening brace on the same line.
- **Imports:** explicit only. No wildcard imports (`import x.*`). Static imports are allowed only for test assertions (
  `assertThat`, `assertEquals`) and Mockito helpers.
- **`@Override`** is required on every override.
- **No `public` modifier on interface members** — it is the default.
- **Records over POJOs** where appropriate, especially for DTOs that don't need mutation.

## Spring Boot conventions

Spring Boot 3.5.x targets Jakarta EE 9+. Use `jakarta.*` imports; **never** `javax.*` (the latter will not even compile
against the current dependencies).

### Beans and injection

- **Constructor injection only.** No `@Autowired` on fields, no setter injection. Kotlin classes use primary constructor
  parameters; Java classes use a single constructor (no `@Autowired` annotation required when there's one constructor).
- **One bean per responsibility.** A `@Service` does one thing; a controller delegates to it.
- **Auto-configuration in a dedicated package.** Bean wiring (`@AutoConfiguration`, `@EnableConfigurationProperties`,
  `@ConditionalOnProperty`) lives in the module's `autoconfigure/` or `config/` package and is registered via the
  `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` file.
- **Use `@SkipComponentScan`** on classes that should be auto-wired only by an explicit `@AutoConfiguration` import —
  not by the application's general component scan.

### Example controller

```kotlin
@RestController
@SkipComponentScan
@RequestMapping("/api/v1/team")
class TeamResource(
    private val teamManagementService: TeamManagementService,
    private val userManagementService: UserManagementService,
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

The full contract — URL conventions, status codes, versioning, error format — lives in
the [API design standards](../documentation/contributing-to-valtimo/api-design-standards.md). Read that first. The rules
below are about **how to write one in this codebase**.

- **One `@RequestMapping("/api/<namespace>v<n>/<resource>")` on the class.** Use `/api/v1/...` for data-plane
  endpoints and `/api/management/v1/...` for management-plane endpoints (see the API design standards for the split).
  The class-level mapping carries the full base path; method-level mappings only add sub-paths. Do not split the
  namespace prefix from `/<resource>` across class and methods.
- **Resources are nouns; verbs are HTTP methods.** `POST /api/v1/team`, not `POST /api/v1/team/create`.
- **`@RequestBody` always carries `@Valid`.** Without it, Bean Validation is not run.
- **Return `Page<T>` for collections.** Spring's `Pageable` argument resolver gives you `page`, `size`, and `sort` query
  params for free.
- **DTOs live in `com.ritense.<module>.web.rest.dto.*`.** Frontend type generation depends on this — see "Generated
  frontend types" above.
- **DTO naming.** `*RequestDto` for inbound, `*ResponseDto` for outbound, `*ListResponseDto` for list rows when the list
  shape differs from the detail shape. Avoid plain `*Dto`.
- **Don't return entities.** Map JPA entities to DTOs at the controller boundary. The entity's shape is for the
  persistence layer; the DTO's shape is for the API contract.

## Validation

Use Bean Validation (`jakarta.validation`) annotations on DTO fields. Cross-link with #417's validation rollout.

- **Every `@RequestBody` is annotated `@Valid`.** Missing `@Valid` is a silent bug — the request is accepted no matter
  what.
- **Every constrained string has a `@Size` matching its Liquibase column.** If a DB column is `VARCHAR(255)`, the DTO
  field carries `@Size(max = 255)`. Mismatches cause runtime `DataIntegrityViolationException` instead of clean 400
  responses.
- **Use the project's custom validators** in `backend/contract/.../validation/` where they apply:
    - `@Url` (`UriUrlValidator`) — for `URI`/`URL` string fields.
    - `@Bsn` (`BsnValidator`) — for Dutch citizen service numbers (validates the 11-proef).
- **Document the absence of a constraint.** If a field is intentionally unbounded (e.g. free-form case content), add a
  brief Kotlin/Java comment explaining why.

Validation errors are translated to RFC 7807 `Problem` responses by `ExceptionTranslator` (see
the [API design standards](../documentation/contributing-to-valtimo/api-design-standards.md) for the exact response
shape).

## Security practices

This section captures the rules that affect every code path. See also
the [data processing guidelines](../documentation/contributing-to-valtimo/data-processing-guidelines.md) for what the
platform may and may not log/store.

### Authentication and authorization

- **Keycloak via Spring Security.** Authentication is handled framework-wide. Controllers do not parse tokens.
- **Never hand-roll role checks.** Authorization decisions go through the [`backend/authorization/`](authorization/)
  module and the permission DSL. Direct `@PreAuthorize("hasRole('X')")` exists in legacy code but is no longer the path
  forward — new code uses the authorization service.
- **Test as the user, not as admin.** Integration tests should exercise the realistic role; admin tests miss
  authorization bugs.

### Secrets

- Never commit secrets to source. Pre-commit hooks and Gradle's `dependencyLicenseReport` will not catch every case —
  review your diff.
- Never log secrets. This includes JWTs, API keys, passwords, and any token used to authenticate to a downstream system.
- Use environment variables / Spring Boot configuration properties. See [
  `documentation/running-valtimo/application-configuration/`](../documentation/running-valtimo/application-configuration/)
  for the pattern.

### Logging

The platform handles personal data and integrates with the Dutch government BRP register. Logging rules are not
negotiable.

- **Never log request bodies, response bodies, or full URLs of personal-data endpoints.** Log the endpoint name and the
  status code instead.
- **Never log:** BSN, full names alongside case content, document bodies, tokens, secrets, raw query strings that may
  contain personal data.
- **DO log:** case ID, internal user ID (UUID), operation outcome, error class. These are safe and useful for
  diagnostics.
- Use SLF4J (`org.slf4j.Logger` / `kotlin-logging`). Use parameterised logging (`log.info("X for case {}", caseId)`) —
  string concatenation runs even when the level is off.

See the [data processing guidelines](../documentation/contributing-to-valtimo/data-processing-guidelines.md) for the
full list of personal-data categories and the never-log / do-log rules.

### SQL & persistence

- **Parameterised queries only.** Hibernate JPQL and MyBatis both support parameter binding — use it.
- **Never concatenate user input into JPQL or native SQL.** This is the most common SQL-injection vector. If you find
  yourself building a query string, use the Criteria API or QueryDSL instead.
- **Native SQL is a code smell.** Allowed when you genuinely need a database-specific feature; in that case both
  PostgreSQL and MySQL variants must be supported (the codebase runs on both — see "Database & migrations" below).

### File uploads and path handling

- **Whitelist content types.** Reject unknown MIME types at the controller boundary.
- **Sanitise filenames.** Strip path separators, control characters, leading dots. Generate a UUID for the storage key —
  don't store user-supplied filenames as paths.
- **Cap upload size.** Enforce both `spring.servlet.multipart.max-file-size` and an application check (the framework
  limit is the floor, not the ceiling).
- **Path traversal.** When constructing paths server-side, resolve against a known base directory and verify the
  resolved path is still inside it (`Path.normalize().startsWith(base)`).

### Dependencies

- **No transitive vulnerability without an explicit override + comment.** The codebase already pins several dependencies
  for CVE reasons — see `backend/build.gradle:266` (plexus-utils precedent). When adding a pin, link the CVE.
- **Don't add dependencies casually.** Each new transitive surface increases the maintenance burden. Prefer using what's
  already on the classpath.

## Database & migrations

The platform runs on both **PostgreSQL** and **MySQL**. Liquibase changesets must be compatible with both. CI runs the
full integration-test suite against each.

### Liquibase rules

- **Changesets live under** `src/main/resources/config/liquibase/<version>/<date>-<description>.xml` (date is
  `YYYYMMDD`). The master changelog at `backend/core/src/main/resources/config/liquibase/changelog-master.xml` includes
  them.
- **Never edit a merged changeset.** Once a changeset has been deployed in any environment, it is frozen. Add a new
  changeset to alter the change. Editing causes Liquibase checksum failures on startup.
- **`author="Ritense"`** by convention; the changeset `id` is unique within the file.
- **Use the `${uuidType}` token** for UUID primary keys — Liquibase expands it differently per
  DB engine.

### Example

```xml
<?xml version="1.1" encoding="UTF-8" standalone="no"?>
<!-- Copyright header omitted for brevity -->
<databaseChangeLog xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                   xsi:schemaLocation="...">

  <changeSet author="Ritense" id="1">
    <createTable tableName="team">
      <column name="key" type="VARCHAR(255)">
        <constraints nullable="false" primaryKey="true"/>
      </column>
      <column name="title" type="VARCHAR(255)">
        <constraints nullable="false"/>
      </column>
    </createTable>
  </changeSet>

</databaseChangeLog>
```

### Column-length policy

If the DTO field has `@Size(max = 255)`, the database column must be at least `VARCHAR(255)`.
Keep these two in sync — when changing one, change the other in the same PR.

### JPA entities

- **Constructor-driven, not field-driven.** Initialise via the constructor; use `val` in Kotlin for fields that must not
  change after persistence (the primary key is the canonical example).
- **No bidirectional relationships unless you need them.** They are expensive to maintain in tests and easy to break
  with cascade misconfiguration.
- **`@Embeddable` value objects** are encouraged for domain primitives (e.g. a typed ID).

## Testing

The codebase uses **JUnit 5** for both Java and Kotlin tests. **Mockito + mockito-kotlin** for mocking. Kotest is on the
classpath (`kotestVersion=5.9.1`) but is barely used — do not introduce new Kotest specs without a discussion first.

### Test layout

- **Unit tests** live in `src/test/`. Naming: `*Test.kt` / `*Test.java`.
- **Integration tests** live in `src/test/` under the same package, named `*IntTest.kt` (the
  Gradle source-set picks them up by name). They run against a real PostgreSQL or MySQL via
  `./gradlew integrationTestingPostgresql` / `integrationTestingMysql`.
- **A `BaseIntegrationTest`** lives in each module's `src/test/kotlin/.../` and sets up the
  Spring context, test profile, and DB rollback policy. New integration tests extend it.

### Unit test example

```kotlin
class LocalOutboxServiceTest {

    private val cloudEventFactory = mock<CloudEventFactory>()
    private val publishedEvents = CopyOnWriteArrayList<CloudEvent>()
    private val applicationEventPublisher = ApplicationEventPublisher { event ->
        if (event is CloudEvent) publishedEvents.add(event)
    }
    private lateinit var localOutboxService: LocalOutboxService

    @BeforeEach
    fun setUp() {
        publishedEvents.clear()
        localOutboxService = LocalOutboxService(cloudEventFactory, applicationEventPublisher)
    }

    @Test
    fun `should publish event when transaction commits`() {
        // arrange
        whenever(cloudEventFactory.create(any())).thenReturn(/* ... */)
        // act
        localOutboxService.send(BaseEvent(/* ... */))
        // assert
        assertThat(publishedEvents).hasSize(1)
    }
}
```

### Conventions

- **Mocking.**  `mockito-kotlin` (`mock`, `whenever`, `verify`, `any`) for Kotlin. Plain Mockito for Java. **No MockK
  ** — it is not on the classpath.
- **Assertions.** `AssertJ` (`org.assertj.core.api.Assertions.assertThat`) is the project standard for both Java and
  Kotlin.
- **Test names.** Kotlin: backtick-quoted sentences (`` `should X when Y` ``). Java: camelCase starting with `should` or
  `test`.
- **Controller slice tests** use `@WebMvcTest` with `@MockitoBean` for collaborators. Reach for full `@SpringBootTest`
  only when the slice can't represent the behaviour (e.g. when behaviour depends on multiple HTTP layers).
- **One assertion concern per test.** Multiple `assertThat` calls in one test are fine as long as they verify the same
  outcome from different angles.

### Coverage

`./gradlew testCodeCoverageReport` produces a JaCoCo report. There is no hard threshold today, but new code is expected
to be covered — both happy path and error cases.

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

The platform uses the **outbox pattern** to publish domain events. When you mutate an aggregate, emit an outbox event so
downstream consumers (audit log, notifications, external integrations) react reliably.

### Event naming

- **Past tense, factual.** `CaseCreated`, `TaskAssigned`, `DocumentUploaded`. Not `CreateCase` (that's a command, not an
  event).
- **`*Viewed` events for read-side audit.** Use when access to personal data needs to be logged.
- **No `*Listed` events.** A list view is not a meaningful audit event — emitting one per list call swamps the outbox.

### Event shape

Events extend `BaseEvent` and follow the CloudEvents spec for transport. Keep the payload small and stable — once an
event is emitted in production, consumers depend on its shape and
the [deprecation policy](../documentation/contributing-to-valtimo/deprecation-policy.md) applies to event fields the
same way it applies to REST DTOs.

### Async work

- **`@Async` for fire-and-forget.** Spring's executor handles thread pooling.
- **`@Scheduled` for periodic jobs.** Pair with ShedLock (`shedlockVersion=6.4.0`) on multi-node deployments so each job
  runs once per cluster.
- **RabbitMQ consumers** use Spring Cloud Stream. The binding lives in `application.yml` and is documented in
  `documentation/running-valtimo/application-configuration/`.

## Plugin SPI stability

Anything in a `public` Kotlin/Java package that a partner can call from a plugin is part of the
**stable API surface**. This includes:

- Interfaces and abstract classes in `backend/contract/`.
- Classes annotated `@Plugin`, `@PluginAction`, `@PluginProperty`, `@PluginCategory`, or exposed as public beans from
  a module's `@AutoConfiguration` class.
- Event payloads emitted on the outbox.
- REST endpoints (those are governed by
  the [API design standards](../documentation/contributing-to-valtimo/api-design-standards.md)).

Changes to this surface must follow
the [deprecation policy](../documentation/contributing-to-valtimo/deprecation-policy.md):

1. Announce in a minor release — Java: `@Deprecated(since = "13.N", forRemoval = true)` plus a Javadoc `@deprecated`
   tag; Kotlin: `@Deprecated("<reason>", ReplaceWith("<new call>"), DeprecationLevel.WARNING)`.
2. Document the migration in the release notes.
3. Remove no earlier than the policy's removal window.

Internal-only refactors (no public surface change) are not covered by the policy — refactor freely as long as the public
API is preserved.

## Reference: tool versions

The versions below come from `gradle.properties` and `.java-version`. Pin facts to those files; this table is a
convenience snapshot for new joiners.

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

---

**Last reviewed:** 2026-06-09. When a fact in this document goes stale, update it in the same PR that changes the
underlying behaviour. The build doesn't enforce documentation freshness, so it is the author's responsibility.
