# 13.47.0

Release date: 23-09-2026

---

## New Features

### New feature title

New feature explanation.

---

## Enhancements

### The task panel in a case keeps the width you give it

The panel on the right of a case can now be dragged wider or narrower while the task list is shown, not only
while a task is open. The width you set is remembered for you across all case types and after logging in again.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Case types | A building block action on the Actions tab can be saved on another version |
| IKO | Widgets and search results now show when data could not be retrieved, instead of looking the same as when there is no data |

---

## Security

| Severity | Fix |
|----------|-----|
| Critical | Protected pages and files can no longer be reached by working around the login check, and a request can no longer be captured and sent again. |
| Critical | When Valtimo contacts another system over a secure connection, it now checks that it really is that system, so another server cannot take its place. |
| Critical | Documents built from templates can no longer be used to read files that were never meant to be part of them. |
| Critical | A security certificate that has been withdrawn can no longer be passed off as still valid. |
| High | Users can no longer reach things they have no rights to, and connections that break off no longer leave the server holding on to resources. |
| High | Deliberately malformed network traffic can no longer make Valtimo run out of memory or stop responding. |
| High | A database connection that is set to use the strongest protection is no longer quietly allowed to fall back to a weaker one. |
| High | A database user with limited rights can no longer reach data they are not allowed to see. |
