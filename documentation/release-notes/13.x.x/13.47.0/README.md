# 13.47.0

Release date: 23-09-2026

---

## New Features

### More filter options for the task count widget

A task count widget can now be limited to a single case type, and its conditions can be combined with **AND** or **OR** in groups that can be nested. Counts that previously could not be configured, such as the assigned tasks of one case type that have one of two names, now take a single widget. Existing task count widgets keep working unchanged.

### Roltypen from the Catalogi API

Two new Catalogi API plugin actions make the roltypen of a zaaktype available to a process:

- **Retrieve roltypen** stores every roltype of the zaaktype in a process variable, each with its
  URL and its description, ready to be offered in a form.
- **Retrieve roltype** stores the URL of a single roltype in a process variable. The roltype can be
  given as a description, which is looked up against the zaaktype of the case, or as a URL.

---

## Enhancements

### The task panel in a case keeps the width you give it

The panel on the right of a case can now be dragged wider or narrower while the task list is shown, not only
while a task is open. The width you set is remembered for you across all case types and after logging in again.

### Stop the other processes of a case and carry on

A process can now stop all other running processes of its case and then continue its own flow, so a rejection can clear the remaining work and still set a status or send a letter. It sits in the expression dropdown in the BPMN modeler next to the existing option, which stops every process of the case including the calling process.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Case types | A building block action on the Actions tab can be saved on another version |
| Startup | A case definition that is not final no longer slows startup down as it gains processes. In a test case definition with 200 processes, startup took almost nine minutes and now takes under a minute |
| SmartDocuments / Exact | These modules no longer bring their own copy of the Valtimo platform modules along, so pinning an older version of them no longer pulls an older Valtimo into the application. |

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
