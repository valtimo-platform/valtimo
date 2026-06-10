# Data processing guidelines

This page is the **developer-facing** chapter on data processing in Valtimo. It tells contributors what the platform
stores, what they may and may not log, and how to wire retention and erasure into new modules so that the platform stays
GDPR-compliant.

The **policy-facing** chapter — DPIA templates, processor agreements, Register of Processing Activities — is owned by
the privacy / data-protection workstream and lives separately. This document focuses on what you do in code.

Related docs:

- [Backend coding guidelines § Security practices](../../backend/CODING-GUIDELINES.md#security-practices) — the rules
  these guidelines build on.
- [API design standards](api-design-standards.md) — how erasure / export endpoints should be shaped.
- [`SECURITY.md`](../../SECURITY.md) — incident reporting.

## What Valtimo stores

The platform stores both structured business data and personal data. Below is the inventory by module. New modules that
store personal data should add a row to this table in the same PR that introduces the storage.

| Data class                         | Owning module            | Storage location             | Notes                                                                                                 |
|------------------------------------|--------------------------|------------------------------|-------------------------------------------------------------------------------------------------------|
| Case documents (JSON content)      | `document`               | `json_schema_document` table | May contain free-text fields with arbitrary personal data.                                            |
| Case binaries (uploaded files)     | `temporary-file-storage` | Object store / file system   | See [temporary file storage](../running-valtimo/application-configuration/temporary-file-storage.md). |
| Audit log                          | `audit`                  | `audit_record` table         | Captures who-did-what; user IDs (UUID) only, not names.                                               |
| Outbox messages (in-flight events) | `outbox`                 | `outbox_message` table       | Cleared after publication; payload follows the event-shape rules.                                     |
| Tasks                              | `process-document`       | Operaton tables              | Linked to a case; may reference a candidate user.                                                     |
| Notes                              | `notes`                  | `note` table                 | Free text; treat as case content.                                                                     |
| IKO conversation data              | `iko`                    | `iko_*` tables               | Customer-interaction history.                                                                         |
| Keycloak users                     | external (Keycloak)      | Keycloak realm               | Not stored in Valtimo's DB; referenced by UUID.                                                       |

This list is not exhaustive — when adding a new module, audit your storage and add a row.

## Categories of personal data

The platform commonly handles:

- **BSN** (Burgerservicenummer) — Dutch citizen service number. Validated via
  `com.ritense.valtimo.contract.validation.Bsn` / `BsnValidator`. **Sensitive** — handle with the rules below.
- **Names** — first, last, full. Sensitive when combined with case content.
- **Addresses** — postal address from BRP lookup.
- **Contact details** — email, phone. Phone numbers are partially anonymised in some custom case headers (see
  [`features/case/for-developers/custom-case-headers.md`](../features/case/for-developers/custom-case-headers.md) for
  the precedent).
- **Case content (free text)** — by definition, may contain anything. Treat the full document as sensitive.

**Special categories** (GDPR Art. 9 — health, ethnicity, religion, sexual orientation, biometrics, genetics): the
platform has no dedicated columns for these. They may end up in case content fields configured by case implementers. If
your module introduces a column or schema slot intended for a special category, flag it in the PR description so the
privacy reviewer can sign off.

## Retention

### Case retention

Cases have an internal status property called the **retention period**. When set, the platform calculates an expiration
date for the case. On expiry:

- The case is deleted from Valtimo's database.
- Linked ZGW data (case details, objects, uploaded documents) is removed from connected ZGW platforms.
- Audit-log entries that reference the case remain — they are required for compliance evidence.

See [`documentation/features/case/README.md`](../features/case/README.md) (§ Retention date) for the user-facing
configuration.

The sentinel value `-1` means **never expire**. The retention date is not calculated and not cleared when the status
with `-1` retention is set.

### Custom modules

When adding a module that stores personal data:

1. Decide whether retention is required (hint: if the data is referenced from a case, the answer is yes — at minimum the
   link should be removed when the case is deleted).
2. Wire a deletion path: either listen to the case-deleted outbox event, or expose a hook the case service can call.
3. Document the retention behaviour in the module's feature documentation.

## Logging & telemetry rules

These rules expand
on [backend coding guidelines § Security practices > Logging](../../backend/CODING-GUIDELINES.md#logging).

### Never log

- BSN (full or partial).
- Full names alongside case content.
- Document bodies (any user-supplied text content).
- Tokens, JWTs, API keys.
- Request bodies or response bodies of personal-data endpoints.
- Query strings of personal-data endpoints (they appear in access logs).
- Stack traces that include personal data in exception messages — review what your custom exceptions carry in their
  `message`.

### Do log

- Case ID (UUID).
- Internal user ID (UUID).
- Operation outcome (`created`, `updated`, `denied`).
- Error class (the class name, not the localised message).
- Correlation ID for tracing across services.

### Logging mechanics

- **Parameterised logging.** `log.info("Updated case {} by user {}", caseId, userId)`. Not string concatenation — even
  when the level is off, the concatenation runs.
- **SLF4J / kotlin-logging.** No `println`, no `System.out`. The build's log configuration is set up so that personal
  data does not accidentally flow to remote log aggregators when teams follow the rules above.

## Right to erasure / export

Two GDPR-driven flows the platform should support:

### Erasure ("right to be forgotten")

When a data subject requests erasure of a case:

1. The case service deletes the case row from `json_schema_document`.
2. The outbox emits `DocumentDeleted` (see `com.ritense.document.event.DocumentDeleted`) with the document ID.
3. Each module listening to `DocumentDeleted` removes its references — including the Documenten API integration, which
   emits its own `DocumentDeleted` against the remote ZGW document.
4. Audit-log entries in `audit_record` are retained — they hold the user ID (UUID), not the name. They are the
   compliance evidence that the erasure happened.

When adding a new module that stores per-document data:

- Subscribe to `DocumentDeleted` and delete your rows.
- Emit your own `*Deleted` event so downstream consumers can react.

### Subject-access export

A subject-access request (Art. 15) requires producing all personal data the platform holds about a person. The platform
does not currently ship a turn-key export, but custom case implementations can wire one:

- Expose the relevant DTOs from your module via a `GET /api/v1/<module>/export/{subjectId}` endpoint, returning a
  structured JSON document.
- The endpoint is authorisation-gated to a privacy-officer role.
- Avoid soft-delete confusion — the export should reflect the data that would actually be returned to the subject, not
  historical rows that have been logically erased.

## Sub-processor boundary

External systems Valtimo integrates with — each is a sub-processor under GDPR:

| System              | Purpose                        | Owned by          |
|---------------------|--------------------------------|-------------------|
| Keycloak            | Identity and access management | Operator-deployed |
| RabbitMQ            | Outbox publishing              | Operator-deployed |
| Object storage      | Uploaded file binaries         | Operator-deployed |
| Haal Centraal (BRP) | Citizen data lookup            | Dutch government  |
| Mandrill / SMTP     | Outbound email                 | Operator-chosen   |
| Open Klant / IKO    | Customer interactions          | Operator-deployed |

When you add a new outbound integration:

1. Add the system to this table (or to the operator's processor inventory if the system is operator-chosen).
2. Document the data flowing out — fields, frequency, retention on the remote side.
3. Make sure the integration respects the platform's retention and erasure flows (delete remote data when the local case
   is deleted, where the remote API supports it).

## Anonymisation in lower environments

Production-like data must be anonymised before use in development or test environments.

- **For local dev**, use the seed data shipped in `backend/app/gzac/imports/`. It is synthetic.
- **For shared test environments**, the operator anonymises personal data before loading dumps.
- **Direct database access** (e.g. `psql` against the local Docker Postgres) is acceptable for the local dev database
  only. Do not point local tooling at shared environments.

Never commit a snapshot of production data to the repository.

## Incident reporting

For suspected personal-data breaches or security issues, follow [`SECURITY.md`](../../SECURITY.md). The
responsible-disclosure flow goes through the security team; do not file public GitHub issues for security or privacy
incidents.

## Cross-references

- [Backend coding guidelines](../../backend/CODING-GUIDELINES.md) — logging, validation, authorization patterns.
- [API design standards](api-design-standards.md) — shape of export / erasure endpoints.
- [Temporary file storage](../running-valtimo/application-configuration/temporary-file-storage.md) — where uploaded
  binaries live and how they expire.
- [`SECURITY.md`](../../SECURITY.md) — incident reporting.

---

**Last reviewed:** 2026-06-09. When a new module starts storing personal data, add it to the inventory and review the
logging and retention sections.
