<!--
  Copyright 2015-2026 Ritense BV, the Netherlands.
  Licensed under EUPL, Version 1.2 (the "License");
  https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
-->

# The Valtimo API and event catalogue

> **Audience:** plugin and app developers. This page answers "what can my plugin actually reach in
> Valtimo, and what can it react to?" — the two questions
> [`permissions.endpoints`](./develop-a-plugin.md#2-project-anatomy--manifest) and
> `eventSubscriptions` are answers to.

Your manifest declares reach; an administrator grants it; the runtime enforces the granted set.
That makes this page the input to a design decision, not reference trivia: an endpoint you did not
declare is unreachable, an event you did not subscribe to is never delivered, and both lists are
shown to the administrator who decides whether to trust your plugin at all.

---

## Part 1 — Calling the Valtimo API

### Two identities, two meanings

A plugin never has "an API key for Valtimo". It calls with one of two credentials, and choosing
between them is a security decision:

| | Service token | User token |
|---|---|---|
| SDK call | `gzacApi.get(...)` | `gzacApi.asUser.get(...)` |
| Frontend call | – | `sdk.callValtimo(...)` |
| Who it acts as | the configuration itself | the logged-in person using the screen |
| Bounded by | the granted endpoint list | the granted endpoint list **∩** that user's own permissions |
| Available in | every handler | `request()` and `submit()` flows, where a user token exists |
| Lifetime | ~10 minutes, replaced on every discovery poll | short-lived, minted per screen session |

Use `asUser` whenever the result is shown back to that user or the write should be attributable to
them — it is what stops a plugin screen from becoming a way around access control. Use the service
token for work that is the configuration's own, such as a background action on a service task where
no user is present.

Neither token is ever visible to your Wasm code or to the browser: the host attaches the service
token, and the frontend's parent-proxy attaches the user token.

### Finding the endpoints you need

Valtimo exposes an OpenAPI description of its own REST API. On a running instance:

```bash
curl -s http://localhost:8080/v3/api-docs | jq '.paths | keys'
```

That is the authoritative list for the environment you are building against — it matches the
version you will actually be deployed on, which a hand-maintained list in this repository could
not.

The endpoints a plugin reaches for most often:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/document/{id}` | Read a case document, including its `content` |
| `PUT` | `/api/v1/document` | Modify document content |
| `POST` | `/api/v1/document` | Create a document |
| `GET` | `/api/v1/document/{documentId}/note` | List notes on a case |
| `POST` | `/api/v1/document/{documentId}/note` | Add a note to a case |
| `GET` | `/api/v1/task/{taskId}` | Read a user task |
| `POST` | `/api/v1/task/{taskId}/complete` | Complete a user task (task-form Level 2) |
| `GET` | `/api/v1/case-definition` | List case definitions |
| `POST` | `/api/v1/case/{caseDefinitionName}/search` | Search cases |
| `GET` | `/api/v1/users/{userId}` | Look up a user, e.g. a task assignee |

### Declare endpoints so an administrator can say yes

Patterns in `permissions.endpoints` are Ant-style: `*` matches one path segment, `**` matches any
number. `{"method": "GET", "pattern": "/api/v1/document/*"}` covers
`/api/v1/document/{uuid}` but not `/api/v1/document/{uuid}/note`.

Two things are worth knowing before you write the list:

- **Prefer endpoints that carry a description.** Valtimo annotates its handlers with
  `@EndpointDescription`, and the acceptance screen renders that sentence next to each endpoint you
  request. An endpoint without one appears to the administrator as a bare method and path with no
  explanation — which is exactly the kind of entry that gets a plugin rejected. Most of the public
  API is annotated; if a pattern you need shows up bare, that is worth raising rather than working
  around.
- **Ask for the narrowest pattern that works.** `/api/**` is technically one line in your manifest
  and reads on the acceptance screen as "this plugin may do anything". Declare the handful of paths
  you call.

### Endpoints no grant can unlock

Some surfaces are refused to plugin tokens regardless of what the manifest declares and what an
administrator accepted. Declaring them does not fail validation — it fails at runtime, which is a
worse way to find out, so do not declare them:

| Pattern | Why |
|---|---|
| `/api/management/v1/external-plugin/**`, `/api/v1/external-plugin/**` | Plugin administration and user-token minting — a plugin must not register hosts, alter its own grants, or mint tokens for arbitrary users |
| `/api/management/v1/roles/**`, `/api/management/v1/permissions/**` | Role and permission management — privilege escalation |
| `POST`/`PUT`/`PATCH`/`DELETE` on `/api/v1/users/**` | User-account mutation escalates to a real admin login. Reads stay grantable |

The single exception is `GET /api/v1/external-plugin/user-token/introspect`, which apps use to
validate a user token (see [Developing an app](./develop-an-app.md#public-routes-browser-facing-cors-)).

A call outside the granted set — or inside the denylist — comes back as a 403-shaped response
rather than an exception, so handle it as a normal failure path.

---

## Part 2 — Events

### What arrives

Valtimo publishes domain events through a transactional outbox as CloudEvents. The fields your
handler receives map onto that envelope directly:

| `EventInput` field | CloudEvent origin |
|---|---|
| `type` | the event type, e.g. `com.ritense.valtimo.document.created` |
| `id`, `source`, `time` | CloudEvent envelope |
| `userId`, `roles` | who caused the event, when a user did |
| `resultType` | the fully-qualified Valtimo class of the payload |
| `resultId` | the id of the thing the event is about, e.g. the document id |
| `result` | the payload itself, as JSON |

For a case being created, `resultId` is the document id and `result` is the document — so the usual
shape of an event handler is "read `resultId`, then call the API for whatever else you need",
rather than trusting the payload to contain it.

```ts
onEvent((event) => {
  if (event.type !== "com.ritense.valtimo.document.created") return { status: "ignored" };
  const doc = gzacApi.get(`/api/v1/document/${event.resultId}`);
  // …
  return { status: "completed" };
});
```

### Payloads are not a contract

`result` is typed `unknown` on purpose. It is a serialisation of an internal Valtimo class named by
`resultType`, and those classes change between releases without being treated as a breaking change
to your plugin. Read the few fields you need defensively, and prefer an API call over deep payload
access when the data matters.

### Delivery semantics

- **At-least-once.** Handlers must be idempotent; the same event can arrive twice.
- **Only granted subscriptions are delivered**, whatever the manifest says — a new version that
  subscribes to more receives nothing extra until an administrator re-accepts.
- **Events are lost while you are down** unless the administrator put the integration in
  `durable` queue mode. Never treat an event as the only trigger for something that must happen.
- Events from ZGW and Objecten API modules only occur in environments where those modules are
  configured and in use.

### The catalogue

Every type Valtimo's outbox publishes, grouped by area. Payload names are the short form of
`resultType`; a `[]` suffix means the payload is a list.

#### Cases and documents

| Event type | Payload (`result`) |
|---|---|
| `com.ritense.valtimo.document.created` | `JsonSchemaDocument` |
| `com.ritense.valtimo.document.updated` | `JsonSchemaDocument` |
| `com.ritense.valtimo.document.deleted` | `JsonSchemaDocument` |
| `com.ritense.valtimo.document.viewed` | `JsonSchemaDocument` |
| `com.ritense.valtimo.document.listed` | `JsonSchemaDocument[]` |
| `com.ritense.valtimo.document.assigned` | `JsonSchemaDocument` |
| `com.ritense.valtimo.document.unassigned` | `JsonSchemaDocument` |
| `com.ritense.valtimo.document.status.changed` | `JsonSchemaDocument` |
| `com.ritense.valtimo.document.tags.changed` | `JsonSchemaDocument` |
| `com.ritense.valtimo.document.expired` | `JsonSchemaDocument` |
| `com.ritense.valtimo.document.retentiondate.set` | `JsonSchemaDocument` |
| `com.ritense.valtimo.document.retentiondate.unset` | `JsonSchemaDocument` |
| `com.ritense.valtimo.document.exported` | `CaseExportRequest` |

#### Tasks

| Event type | Payload (`result`) |
|---|---|
| `com.ritense.valtimo.task.completed` | `OperatonTask` |
| `com.ritense.valtimo.task.assigned` | `OperatonTask` |
| `com.ritense.valtimo.task.unassigned` | `OperatonTask` |
| `com.ritense.valtimo.task.dueDateSet` | `OperatonTask` |

#### Notes

| Event type | Payload (`result`) |
|---|---|
| `com.ritense.valtimo.note.created` | `Note` |
| `com.ritense.valtimo.note.updated` | `Note` |
| `com.ritense.valtimo.note.deleted` | `Note` |
| `com.ritense.valtimo.note.viewed` | `Note` |
| `com.ritense.valtimo.note.listed` | `Note[]` |

#### Forms and form flows

| Event type | Payload (`result`) |
|---|---|
| `com.ritense.form.submission.created` | `IntermediateSubmissionCreated` |
| `com.ritense.form.submission.changed` | `IntermediateSubmissionChanged` |
| `com.ritense.formflow.step.completed` | `FormFlowStepCompletedResult` |

#### Case definitions

| Event type | Payload (`result`) |
|---|---|
| `com.ritense.valtimo.case.configuration-issue.updated` | `CaseDefinitionConfigurationIssue` |

#### ZGW — Zaken API (zrc)

| Event type | Payload (`result`) |
|---|---|
| `com.ritense.gzac.zrc.zaak.created` | `ZaakResponse` |
| `com.ritense.gzac.zrc.zaak.patched` | `PatchZaakResponse` |
| `com.ritense.gzac.zrc.zaak.viewed` | `ZaakResponse` |
| `com.ritense.gzac.zrc.zaak.listed` | `ZaakResponse` |
| `com.ritense.gzac.zrc.zaak.opschorting.updated` | `ZaakopschortingResponse` |
| `com.ritense.gzac.zrc.zaakstatus.created` | `CreateZaakStatusResponse` |
| `com.ritense.gzac.zrc.status.viewed` | `ZaakStatus` |
| `com.ritense.gzac.zrc.zaakresultaat.created` | `CreateZaakResultaatResponse` |
| `com.ritense.gzac.zrc.zaakresultaat.deleted` | `DeleteZaakResultaatResponse` |
| `com.ritense.gzac.zrc.resultaat.viewed` | `ZaakResultaat` |
| `com.ritense.gzac.zrc.rol.created` | `Rol` |
| `com.ritense.gzac.zrc.rol.updated` | `Rol` |
| `com.ritense.gzac.zrc.rol.deleted` | — |
| `com.ritense.gzac.zrc.rol.listed` | `Rol[]` |
| `com.ritense.gzac.zrc.zaakeigenschap.created` | `ZaakeigenschapResponse` |
| `com.ritense.gzac.zrc.zaakeigenschap.updated` | `ZaakeigenschapResponse` |
| `com.ritense.gzac.zrc.zaakeigenschap.deleted` | — |
| `com.ritense.gzac.zrc.zaakeigenschap.listed` | `ZaakeigenschapResponse[]` |
| `com.ritense.gzac.zrc.zaakinformatieobject.linked` | `LinkDocumentResult` |
| `com.ritense.gzac.zrc.zaakinformatieobject.viewed` | `ZaakInformatieObject` |
| `com.ritense.gzac.zrc.zaakinformatieobject.listed` | `ZaakInformatieObject[]` |
| `com.ritense.gzac.zrc.zaakobject.created` | `ZaakObject` |
| `com.ritense.gzac.zrc.zaakobject.viewed` | `ZaakObject` |
| `com.ritense.gzac.zrc.zaakobject.listed` | `ZaakObject[]` |
| `com.ritense.gzac.zrc.zaaknotitie.created` | `ZaakNotitie` |
| `com.ritense.gzac.zrc.zaaknotitie.updated` | `ZaakNotitie` |
| `com.ritense.gzac.zrc.zaaknotitie.patched` | `ZaakNotitie` |
| `com.ritense.gzac.zrc.zaaknotitie.deleted` | `ZaakNotitie` |
| `com.ritense.gzac.zrc.zaaknotitie.viewed` | `ZaakNotitie` |
| `com.ritense.gzac.zrc.zaaknotitie.listed` | `ZaakNotitie[]` |
| `com.ritense.gzac.zrc.zaakbesluiten.listed` | `ZaakbesluitResponse[]` |

#### ZGW — Documenten API (drc)

| Event type | Payload (`result`) |
|---|---|
| `com.ritense.gzac.drc.document.created` | `CreateDocumentResult` |
| `com.ritense.gzac.drc.document.updated` | `DocumentInformatieObject` |
| `com.ritense.gzac.drc.document.deleted` | `DocumentInformatieObject` |
| `com.ritense.gzac.drc.document.listed` | `DocumentInformatieObject[]` |
| `com.ritense.gzac.drc.enkelvoudiginformatieobject.viewed` | `DocumentInformatieObject` |
| `com.ritense.gzac.drc.enkelvoudiginformatieobject.downloaded` | — |
| `com.ritense.gzac.drc.enkelvoudiginformatieobject.audittrail.listed` | `AuditTrail[]` |
| `com.ritense.gzac.drc.objectinformatieobject.created` | `ObjectInformatieObject` |
| `com.ritense.gzac.drc.objectinformatieobject.deleted` | `ObjectInformatieObject` |

#### ZGW — Objecten API

| Event type | Payload (`result`) |
|---|---|
| `com.ritense.gzac.objecten-api.object.created` | `ObjectWrapper` |
| `com.ritense.gzac.objecten-api.object.updated` | `ObjectWrapper` |
| `com.ritense.gzac.objecten-api.object.patched` | `ObjectWrapper` |
| `com.ritense.gzac.objecten-api.object.deleted` | — |
| `com.ritense.gzac.objecten-api.object.viewed` | `ObjectWrapper` |
| `com.ritense.gzac.objecten-api.object.listed` | `ObjectWrapper[]` |

> This catalogue is derived from the event classes in the Valtimo backend. To re-derive it for a
> specific version, search that version's source for `BaseEvent(` — each subclass declares its
> `type` and `resultType`.
