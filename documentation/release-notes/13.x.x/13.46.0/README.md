# 13.46.0

Release date: 16-09-2026

---

## New Features

### New feature title

New feature explanation.

---

## Enhancements

### New enhancement title

New enhancement explanation.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Forms | Number fields in a form now use the notation of the user's language, so a Dutch user reads and enters 1234,56 instead of 1234.56 |
| Forms | Standard form buttons and messages, such as Versturen, Opslaan and Annuleren, now appear in the user's language instead of always in English |
| IKO | A slow IKO server no longer holds up other parts of the application while widget data is loading |
| Plugins | The zaakrol configuration of the verzoek plugin is applied to the KvK task that 13.45.0 added, so a verzoek with a KvK number creates its initiator zaakrol again. No manual reconfiguration is needed after upgrading |
| Search fields | A task list search field can be saved without a title, as its tooltip already describes. The task list then shows the search field key as the label |
