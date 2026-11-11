# 13.54.0

Release date: 11-11-2026

---

## Enhancements

### Delete a case group

A case group can now be deleted from its page. Click **Delete** in the page header and confirm. The
group disappears from the Cases overview and from every user's pinned items. The case definitions
in the group and their cases are not affected.

More information: [Deleting a case group](../../../configuration-guides/cases/case-groups/configuration.md#deleting-a-case-group).

### Match type for case group search fields

A text search field of a case group now always has a match type. New fields start with
**Contains**. The search fields list shows the match type that applies, as **Exact** or
**Contains**. Existing text fields without a match type keep searching as **Exact**.

### Colors in the Cases overview

Case group tiles in the Cases overview always show the color of the group, not only when they are
pinned. With **Show all case definitions in the menu** on, the case definitions in the left sidebar
show their color too.

---

## Bugfixes

| Area | Fix |
|------|-----|
| Access control | Exporting a role now includes the context (resource type and conditions) configured on its permissions. |
| Case definitions | Saving case settings no longer replaces the external start form description with the start form URL. |
| Case groups | Opening a case group that doesn't exist no longer loads the list columns, search fields and statuses of that group. |
| Case management | Actions hidden from the start menu stay hidden after creating a new version of the case type or changing the building block version of the action. |
| Case management | Importing a case definition lists the plugin configurations used by its processes again, so they can be mapped to plugin configurations in this environment. |
| Dashboard | A bar chart widget with many categories no longer overflows its widget and overlaps other widgets. The legend now scrolls inside the widget. |
| Dashboard | A donut or bar chart widget with a long legend no longer shows two vertical scrollbars next to each other. |
| Dashboard | A long dashboard widget subtitle is now cut off with ellipsis instead of running out of the widget, and the full title and subtitle show on hover. |
| Forms | Disabled fields in forms now show their value in readable text, styled as read-only instead of faded grey. |
| Left sidebar | Opening the Cases overview directly expands **Cases** in the left sidebar, so pinned items are visible. |

---

## Security

| Severity | Fix |
|----------|-----|
| High | The Objecten API plugin now validates object URLs more strictly and only accepts URLs that belong to the Objecten API it is configured with. If your Objecten API returns object URLs with a different host, port or path than the URL in the plugin configuration, update the plugin configuration to match, otherwise those objects can no longer be opened, changed or deleted. |
| High | The deprecated Documenten API endpoints for downloading, changing and deleting a document now check access more strictly. A document is only available through these endpoints when it is linked to a case the user can view. These endpoints will be removed in Valtimo 14. Use the endpoints that take the case as input instead. |
| High | Access checks on the documents of a case are stricter. Downloading, previewing, changing and deleting a document now also requires permission to view the case the document belongs to. |
