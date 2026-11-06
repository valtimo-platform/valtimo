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
| Case definitions | Saving case settings no longer replaces the external start form description with the start form URL. |
| Case groups | Opening a case group that doesn't exist no longer loads the list columns, search fields and statuses of that group. |
| Left sidebar | Opening the Cases overview directly expands **Cases** in the left sidebar, so pinned items are visible. |
