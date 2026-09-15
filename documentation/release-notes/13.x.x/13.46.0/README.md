# 13.46.0

Release date: 16-09-2026

---

## New Features

### New feature title

New feature explanation.

---

## Enhancements

### Stop the other processes of a case and carry on

A process can now stop all other running processes of its case and then continue its own flow, so a rejection can clear the remaining work and still set a status or send a letter. It sits in the expression dropdown in the BPMN modeler next to the existing option, which stops every process of the case including the calling process.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Forms | Number fields in a form now use the notation of the user's language, so a Dutch user reads and enters 1234,56 instead of 1234.56 |
| Forms | Standard form buttons and messages, such as Versturen, Opslaan and Annuleren, now appear in the user's language instead of always in English |
| IKO | A slow IKO server no longer holds up other parts of the application while widget data is loading |
| Search fields | A task list search field can be saved without a title, as its tooltip already describes. The task list then shows the search field key as the label |
