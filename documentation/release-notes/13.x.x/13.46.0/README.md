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

| Area            | Fix                                                                           |
|-----------------|-------------------------------------------------------------------------------|
| Area | Fix |
|------|-----|
| Building blocks | A file uploaded from a task form inside a building block is added to the case |
| Building blocks | Importing a case definition with a building block again lists each of the building block's processes once on the Processes tab, instead of adding another row every import |
| Case and task lists | Paging through a list sorted on a column that repeats values, such as the assignee, no longer shows the same case or task on two pages while leaving others out |
| Forms | Number fields in a form now use the notation of the user's language, so a Dutch user reads and enters 1234,56 instead of 1234.56 |
| Forms | Standard form buttons and messages, such as Versturen, Opslaan and Annuleren, now appear in the user's language instead of always in English |
| IKO | A slow IKO server no longer holds up other parts of the application while widget data is loading |
| Plugins | A call to a slow Zaken or Objecten API now waits up to 180 seconds for an answer instead of giving up after a few seconds. Giving up early could leave a zaak behind without a case around it |
| Search fields | A task list search field can be saved without a title, as its tooltip already describes. The task list then shows the search field key as the label |
