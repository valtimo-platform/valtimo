# 13.46.0

Release date: 16-09-2026

---

## New Features

### New feature title

New feature explanation.

---

## Enhancements

### Suggested keys for list columns and search fields

When adding a list column or a search field, the key is now suggested based on the title you enter,
and remains yours to change with the pencil button.

### Activity IDs based on the activity name

In the process editor, an activity you draw now gets an ID based on the name, instead
of a generic one. Activities that already existed keep their ID, and once you edit an ID by hand
it stays exactly as you typed it. IDs are limited to 64 characters.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Building blocks | A file uploaded from a task form inside a building block is added to the case |
| Case and task lists | Paging through a list sorted on a column that repeats values, such as the assignee, no longer shows the same case or task on two pages while leaving others out |
| Forms | Number fields in a form now use the notation of the user's language, so a Dutch user reads and enters 1234,56 instead of 1234.56 |
| Forms | Standard form buttons and messages, such as Versturen, Opslaan and Annuleren, now appear in the user's language instead of always in English |
| IKO | A slow IKO server no longer holds up other parts of the application while widget data is loading |
| Notificaties API | Notifications are received again when the plugin's Authentication header starts with "Bearer". Until now every notification sent with such a header was refused, even when the header was exactly the one registered with the subscription |
| Plugins | A call to a slow Zaken or Objecten API now waits up to 180 seconds for an answer instead of giving up after a few seconds. Giving up early could leave a zaak behind without a case around it |
| Search fields | A task list search field can be saved without a title, as its tooltip already describes. The task list then shows the search field key as the label |
