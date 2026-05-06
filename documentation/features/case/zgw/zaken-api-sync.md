# Zaak sync

Zaak sync configures how Valtimo propagates case changes to the linked zaak in the Zaken API, scoped per case
definition. The sync is one-way (Valtimo → Zaken API) and currently covers two synchronisations:

- **Behandelaar sync** — when the dossier assignee changes, Valtimo creates (or updates) a behandelaar rol on
  the linked zaak with `betrokkeneType = medewerker`, using the roltype URL configured per case definition.
- **Note sync** — when a note is added, updated or deleted on a case, Valtimo creates, updates or deletes the
  corresponding `ZaakNotitie` on the linked zaak.

Both toggles are stored per case definition, so different case types served by the same Zaken API plugin can
have different sync behaviour.

## Configuring zaak sync

Navigate to `Admin > Cases > {Case name} > [ZGW] > [Zaak-synchronisatie]` to configure the synchronization
settings. Toggle behandelaar sync and pick the roltype that should be used for the behandelaar rol, toggle note
sync, and (when note sync is enabled) set the subject (`onderwerp`) that will be used when creating a
`ZaakNotitie`.

## Behandelaar sync details

- The behandelaar rol is created with `betrokkeneType = medewerker`. The Keycloak username (truncated to 24
  characters, the OpenZaak `medewerkerIdentificatie.identificatie` limit) is used as `identificatie`. The user's
  last name is used as `achternaam`; if it is unavailable the username is used as a fallback.
- The roltype is selected per case definition (stored as `roltypeUrl` on the sync configuration). It should
  point to a roltype with `omschrijvingGeneriek = "behandelaar"` on the linked zaaktype, because cleanup on
  reassign filters existing rollen by that generic description — choosing a non-behandelaar roltype will leave
  previous rollen in place.
- On reassign, Valtimo deletes the previous GZAC-managed behandelaar and creates a new one with
  `beginGeldigheid = today`. OpenZaak's built-in audittrail (`/zaken/{uuid}/audittrail`) records both
  events.

## Note sync details

- Triggered by Valtimo `NoteCreatedEvent`, `NoteUpdatedEvent` and `NoteDeletedEvent`.
- The configured `noteSubject` is sent as `onderwerp`; the note content is sent as `tekst`. The user that
  created the note in Valtimo is propagated to `aangemaaktDoor` on create.
- Valtimo keeps a `ZaakNotitieLink` between the local note and the remote `ZaakNotitie` so updates and deletes
  hit the right resource.
