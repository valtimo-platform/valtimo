# 13.39.0

{% hint style="info" %}
**Release date 29-07-2026**
{% endhint %}

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **Case detail updates the internal status and assignee live**

  The case detail screen now refreshes the internal status tag and the assignee automatically when they change, without
  switching tabs or reloading the page. When a case's internal status changes — for example because a user task is
  completed or a timer expires — or when the case is (un)assigned, the change is now broadcast over the existing
  Server-Sent Events (SSE) connection and the screen re-fetches the case so it always reflects the current state. This
  adds a new `CASE_STATUS_UPDATED` SSE event and includes the `documentId` on the existing `CASE_ASSIGNED`
  and `CASE_UNASSIGNED` events. Team assignment and unassignment now also emit `CASE_ASSIGNED` / `CASE_UNASSIGNED`
  (previously `DOCUMENT_UPDATED`), so a team change is treated consistently with a user assignment. As with all SSE
  events, the payload contains only the `documentId` and no sensitive data.

## Bugfixes

* New bugfix.
