# 13.46.0

Release date: 16-09-2026

---

## New Features

### Roltypen from the Catalogi API

Two new Catalogi API plugin actions retrieve the roltypen of a zaaktype, so a process adds a
zaakrol without a roltype URL that is entered by hand and corrected for every environment.

**Roltypen opvragen** stores every roltype of the zaaktype in a process variable, each with its URL
and description. **Roltype opvragen** stores the URL of one roltype, identified by its description
or given as a URL, and that URL can be used directly in the zaakrol actions of the Zaken API
plugin.

Both actions use the zaaktype of the zaak linked to the case, unless the action is configured with
a zaaktype URL. When a description matches no roltype, or more than one, the action reports which
of the two occurred.

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
| Search fields | A task list search field can be saved without a title, as its tooltip already describes. The task list then shows the search field key as the label |
