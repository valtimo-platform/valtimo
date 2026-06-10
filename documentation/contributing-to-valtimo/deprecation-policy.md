# Deprecation policy

This page describes how Valtimo retires public API surface. The policy applies to anything a
partner or downstream consumer can depend on; it does not apply to internal refactors that leave
the public surface unchanged.

Related docs:

- [API design standards](api-design-standards.md) — REST endpoint deprecation specifics.
- [Backend coding guidelines](../../backend/CODING-GUIDELINES.md) — what constitutes the public
  surface.
- [Branching and release strategy](branching-and-release-strategy.md) — minor and major cadence.

## What can be deprecated

Anything in the public surface:

- REST endpoints (verb + path).
- Request and response DTO fields.
- Plugin SPI interfaces and abstract classes (`backend/contract/` and `@Plugin` /
  `@PluginAction` / `@PluginProperty` / `@PluginCategory` types).
- Public Kotlin/Java classes and functions in the `com.ritense.*` namespace.
- Outbox event payload fields.
- Configuration properties (`application.yml` keys).
- Liquibase-managed database columns referenced from public DTOs.
- Frontend exported symbols (modules, components, services exported from a `@valtimo/*`
  library's `public-api.ts`).
- Whole modules (sunset).

Internal-only refactors (no public surface change) require no deprecation.

## Timeline

### Internal-facing surface

For surfaces consumed only within the Valtimo monorepo (no partner / no plugin author has a
reasonable reason to depend on them), the minimum window is **two minor releases**:

1. **`13.N`** — Announce. On the symbol, add:
    - Java: `@Deprecated(since = "13.N", forRemoval = true)` plus a Javadoc `@deprecated` tag
      describing the replacement.
    - Kotlin: `@Deprecated("<reason>", ReplaceWith("<new call>"), DeprecationLevel.WARNING)`.

   Add a `## Deprecations` entry to the release notes for `13.N`. Document the migration.
2. **`13.N+2` or later** — Removal is permitted. Never remove in the same minor where
   deprecation was announced (`13.N+1` is too soon — at one-week minor cadence that's only
   ~7 days of consumer notice).

### Partner-facing surface

For surfaces external plugin authors or operator-configured deployments depend on — REST
endpoints, plugin SPI types, outbox event payloads, configuration properties — the window is
longer:

1. **`13.N`** — Announce, same mechanics as above.
2. **Removal no earlier than `13.N+8`** (≈ two months at the current one-week minor cadence)
   **or** the next major release (`14.0.0`), **whichever comes first**.

If the deprecation is breaking (i.e. there is no in-major replacement, only a new major), the
removal target is the next major regardless of cadence.

### Hard cut-off

- **Never remove in the same minor where deprecation was announced.**
- **Never remove without a release-notes `## Deprecations` (announce) + `## Removals` (remove)
  pair.**
- **SemVer pre-release builds** (`-SNAPSHOT`, RC tags) are exempt from this policy — partners
  must not pin to pre-release versions.

## Migration guidance

Every deprecated symbol must offer a migration path:

- **Kotlin `ReplaceWith`** when the replacement is a one-line rename or signature change.
  (Java's `@Deprecated` has no `ReplaceWith`; use a Javadoc `@deprecated` tag instead.)
- **Documentation pointer** when the migration is more involved. Link to a section in the
  release notes or a dedicated migration guide. Precedent:
  [
  `documentation/release-notes/13.x.x/13.0.0/front-end-migration.md`](../release-notes/13.x.x/13.0.0/front-end-migration.md).
- **Migration code snippet** in the release notes entry — one paragraph minimum, showing the
  before/after.

If the migration is mechanical (rename, parameter reorder), a Kotlin `ReplaceWith` is enough.
If the migration is semantic (different behaviour, new responsibility), a written guide is
required.

## Partner / consumer communication

- **Release notes** are the canonical channel. The `## Deprecations` block is published on
  [docs.valtimo.nl](https://docs.valtimo.nl) the moment the release is cut.
- **REST endpoint changes** additionally surface in the OpenAPI spec — deprecated operations
  carry `deprecated: true` and the `Deprecation` / `Sunset` response headers (see
  [API design standards § Deprecating endpoints](api-design-standards.md#deprecating-endpoints)).
- **Plugin SPI changes** are called out in the release announcement.

## Module decommissioning

When a whole module is sunset (precedent: the `Besluit` module, the legacy `connector` Objects API
adapter — see `documentation/fundamentals/architectural-overview/modules.md`):

1. Add a **"Deprecated"** banner at the top of the module's feature documentation
   (`documentation/features/<module>/README.md`).
2. **Stop accepting new features** against the module. Bugfixes and security fixes only.
3. Schedule **full removal at the next major release.**
4. Add the module to the release-notes `## Deprecations` block in the release where step 1
   lands.
5. At removal, delete the source code and the Gradle subproject. Liquibase changesets stay in
   place — the data may have been migrated, and removing a changeset breaks checksum
   validation on existing deployments.

## Surface-specific specifics

### REST endpoints

See [API design standards § Deprecating endpoints](api-design-standards.md#deprecating-endpoints).
Summary:

- `@Deprecated` on the controller method.
- `Deprecation: true` and `Sunset: <date>` headers on every response.
- `@Operation(deprecated = true)` for OpenAPI.
- Release-notes entry under `## Deprecations`.

### Configuration properties

Use Spring's `@DeprecatedConfigurationProperty` on the binding:

```kotlin
@ConfigurationProperties("valtimo.legacy-feature")
class LegacyFeatureProperties {
    @get:DeprecatedConfigurationProperty(
        replacement = "valtimo.new-feature.enabled",
        reason = "Renamed for clarity; will be removed in 14.0.",
    )
    var enabled: Boolean = false
}
```

This emits a `WARN` log on startup when the deprecated property is set, naming the replacement.
Also add the property to the release-notes `## Deprecations` block.

### Plugin SPI

Plugin SPI changes affect external authors who cannot patch their plugins on the day of a
release. They sit in the **partner-facing** tier (≥ `13.N+8` or next major). Additionally:

- The interface or abstract class carries `@Deprecated` with a migration note.
- The replacement is documented in
  [`documentation/contributing-to-valtimo/extend-the-core-or-build-a-plugin.md`](extend-the-core-or-build-a-plugin.md).
- A migration example is added to the release notes.

### Outbox event payloads

Outbox events flow to external consumers (audit log, integrations, notifications). Field-level
changes follow the partner-facing tier:

- **Adding** an optional field — backwards-compatible, no deprecation needed.
- **Removing or renaming** a field — `@Deprecated` on the Kotlin/Java property,
  release-notes entry, removal no earlier than `13.N+8` or next major.
- **Changing the meaning** of a field (e.g. units, encoding) — treat as breaking, emit a new
  event type instead and follow the same partner-facing deprecation for the old type.

### Frontend exported symbols

A symbol re-exported from a `@valtimo/<lib>` library's `public-api.ts` is part of the partner-facing
surface. Apply the partner-facing window. Use TypeScript's `@deprecated` JSDoc tag on the symbol;
modern editors surface it inline.

## Release-notes structure

Each release that announces a deprecation includes a `## Deprecations` section. Each release that
removes a previously-deprecated item includes a `## Removals` section.

### Example (announce)

```markdown
## Deprecations

The following will be removed in 14.0:

* `OutboxMessageRepository.findOutboxMessage()` — use `findOutboxMessages(batchSize)`.
* REST endpoint `GET /api/v1/legacy-thing` — use `GET /api/v1/thing` instead. The new endpoint
  accepts an additional `withDetail` query parameter; see § Migration below.
```

### Example (remove)

```markdown
## Removals

* `OutboxMessageRepository.findOutboxMessage()` — removed in this release (deprecated in 13.22).
  Callers must migrate to `findOutboxMessages(batchSize)`.
```

The release-notes template at [`documentation/templates/release-notes.md`](../templates/release-notes.md)
includes empty `## Deprecations` and `## Removals` blocks; delete them if a release does not
deprecate or remove anything.

## What this policy does not cover

- **Internal-only refactors** — no public surface change, no deprecation cycle.
- **Bugfixes** that restore documented behaviour — fixing a bug is not a breaking change even
  when callers were relying on the buggy behaviour.
- **Pre-release versions** (`-SNAPSHOT`, RCs) — partners must not pin to these.
- **Security fixes** — when a fix requires a breaking change for safety reasons, the change may
  land immediately with a release-notes call-out under `## Security`, bypassing the standard
  deprecation window. This is the exception, not the rule.

---

**Last reviewed:** 2026-06-09.
