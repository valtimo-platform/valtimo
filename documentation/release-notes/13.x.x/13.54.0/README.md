# 13.54.0

Release date: 11-11-2026

{% hint style="warning" %}
This release contains security fixes. See [Security](#security) for details.
{% endhint %}

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
| Case definitions | Saving case settings no longer replaces the external start form description with the start form URL. |
| Case groups | Opening a case group that doesn't exist no longer loads the list columns, search fields and statuses of that group. |
| Case management | Actions hidden from the start menu stay hidden after creating a new version of the case type or changing the building block version of the action. |
| Case management | Importing a case definition lists the plugin configurations used by its processes again, so they can be mapped to plugin configurations in this environment. |
| Dashboard | A bar chart widget with many categories no longer overflows its widget and overlaps other widgets. The legend now scrolls inside the widget. |
| Dashboard | A donut or bar chart widget with a long legend no longer shows two vertical scrollbars next to each other. |
| Dashboard | A long dashboard widget subtitle is now cut off with ellipsis instead of running out of the widget, and the full title and subtitle show on hover. |
| Dashboard | A bar chart widget with many categories no longer overflows its widget and overlaps other widgets. The legend now scrolls inside the widget. |
| Forms | Disabled fields in forms now show their value in readable text, styled as read-only instead of faded grey. |
| Left sidebar | Opening the Cases overview directly expands **Cases** in the left sidebar, so pinned items are visible. |

---

## Security

| Severity | Fix |
|----------|-----|
| High | A file attached to a case can now only be opened by users who are allowed to view that case, and can only be removed from within the case. A file that is not yet attached to a case can only be opened or removed by the person who uploaded it. |
| High | A user can no longer attach a file that someone else uploaded to a case, either while uploading or through a form. Users can also no longer add a file to Valtimo that they did not upload themselves. |
| High | Files can no longer be opened through the old form file link without logging in. Logged-in users get the same access rules as for other case files, and files can no longer be deleted through this link. This link is deprecated and will be removed in the next major version. |
| High | The Objecten API plugin now validates object URLs more strictly and only accepts URLs that belong to the Objecten API it is configured with. If your Objecten API returns object URLs with a different host, port or path than the URL in the plugin configuration, update the plugin configuration to match, otherwise those objects can no longer be opened, changed or deleted. |
| High | The deprecated Documenten API endpoints for downloading, changing and deleting a document now check access more strictly. A document is only available through these endpoints when it is linked to a case the user can view. These endpoints will be removed in Valtimo 14. Use the endpoints that take the case as input instead. |
| High | Access checks on the documents of a case are stricter. Downloading, previewing, changing and deleting a document now also requires permission to view the case the document belongs to. |
| Medium | Completing a task can no longer delete files. |
| Low | Details stored with an uploaded file can no longer be read by other users, apart from the link needed to download it. The person who uploads a file is now always recorded correctly. |
| Low | Submitting a task form for a case that the task does not belong to is now rejected before any uploaded files in it are processed. Before, these files could already be stored before the submission was rejected. |

{% hint style="warning" %}
After upgrading:

* Files uploaded before this version that were never attached to a case can only be opened by administrators.
* Anyone who was in the middle of uploading a file during the upgrade has to upload it again.
* In the rare case that one file was attached to more than one case, it stays available in only one of them.
{% endhint %}
