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
| Forms | Number fields in a form now use the notation of the user's language, so a Dutch user reads and enters 1234,56 instead of 1234.56 |
| Forms | Standard form buttons and messages, such as Versturen, Opslaan and Annuleren, now appear in the user's language instead of always in English |
| IKO | A slow IKO server no longer holds up other parts of the application while widget data is loading |
| Notificaties API | Notifications are received again when the plugin's Authentication header starts with "Bearer". Until now every notification sent with such a header was refused, even when the header was exactly the one registered with the subscription |
| Search fields | A task list search field can be saved without a title, as its tooltip already describes. The task list then shows the search field key as the label |
