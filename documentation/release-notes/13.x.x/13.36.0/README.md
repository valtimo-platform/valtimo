# 13.36.0

{% hint style="info" %}
**Release date 08-07-2026**
{% endhint %}

## New Features

* **Visual permission editor for Access Control**

  Permissions for a role can now be configured through a visual editor in GZAC, alongside the existing JSON editor. The
  role page has three tabs — **Editor** (visual), **Summary** (a read-only overview of the configured permissions), and
  **JSON editor**.

  The visual editor lists a role's permissions in a sidebar and edits each one through a form:

  - pick the **resource type** and the **allowed actions**;
  - build **conditions** — field, JSON field, or a related resource (nested conditions on a linked resource);
  - choose how **context** applies: no restriction, only when there is no context, or a specific context resource.

  When adding a role, its key can be picked from the roles known to the identity provider (Keycloak) or typed manually,
  and roles that are already configured are left out of the picker. Actions are shown as colour-coded tags so a rule is
  recognisable at a glance. See
  [Configuring permissions](../../../features/access-control/configuring-permissions.md).
  
* **Catalogi API plugin action: Get Informatieobjecttypen**

  A new plugin action `get-informatieobjecttypen` has been added to the Catalogi API plugin. This action retrieves the
  collection of informatieobjecttypen belonging to a zaaktype and stores it — as a list of `{url, name}` entries — in a
  process variable. The zaaktype is taken from the linked case by default, or from an optional zaaktype URL. See
  [Catalogi API plugin](../../../features/plugins/configure-catalogi-api-plugin.md#retrieve-informatieobjecttypen).

* **Image widget**

  A new image widget can be added to a case detail tab to display image files that are stored on the case. The
  widget resolves a value resolver path (for example `doc:/uploadedFiles`) to one or more uploaded file resources
  and renders the ones that are browser-renderable images (`png`, `jpg`, `jpeg`, `gif`, `webp`, `avif`, `svg`,
  `bmp`, `ico`). By default the images are shown in a grid, but a **Display as carousel** option presents them one
  at a time with navigation dots and previous/next arrows. See
  [Widgets](../../../features/case/case-detail/tabs/widgets.md) for the configuration details.

* **Object Management Select Form.io component**

  A new Form.io component for selecting objects from an Object Management configuration. Available under "Advanced" in
  the form builder. Features:
  - Configurable columns with sorting and filtering
  - Pagination
  - Multiple selection with min/max validation
  - Value formats: `id` (UUID only), `full` (entire object), `columns` (configured column values)
  
  See [Object Management Select](../../../features/objecten-management/object-management-select.md) for configuration
  details.

## Enhancements

* **Object Management access control (PBAC)**

  Object Management configurations can now be secured with Permission Based Access Control. When enabled with
  `valtimo.object-management.authorization.enabled=true`, the `view_list` permission controls which configurations
  appear in the data menu and object-list pages. Access to the object data itself is governed by the objecten-api
  `Object` permissions. The feature is disabled by default; when disabled, all authenticated users retain full access.
  See [Access control](../../../features/objecten-management/access-control.md) for details.

* **Object Management list sorting**

  Object lists now support column sorting. Columns can be configured with a default sort direction (ascending or
  descending) that applies on initial load. Resolves
  [#125](https://github.com/generiekzaakafhandelcomponent/gzac-issues/issues/125).

## Bugfixes

* Dashboard widgets can now group and filter on more case fields, such as the `case:internalStatus` and
  `case:definitionId.key`.

* **Shared task list URLs now open on the correct tab**

  Opening a copied or bookmarked task list URL now lands on the tab it was saved from (for example *All tasks*),
  instead of defaulting to the first tab.

* **Dropdowns on the case type General tab now show all their options correctly**

  On the General tab of a case type, a dropdown (such as *Link upload process to case*) now displays all of its options
  on top of the surrounding widgets, even when the widgets are stacked. Previously the options could appear behind the
  widget below and be barely visible.

* **Start forms configured to open in a panel opened in a modal instead**

  A supporting process started from the **Start** button always opened its start form in a modal, even when the process
  link was configured with **Display type: Panel**. The configured display type is now respected
  again, so these start forms open in the case detail panel as intended.

* **Object Management list pagination resets when switching object types**

  Pagination no longer persists when navigating between different object types in the Object Management list. Resolves
  [#194](https://github.com/generiekzaakafhandelcomponent/gzac-issues/issues/194).

* **Non-admin users can view object list and detail pages**

  Non-admin users no longer see 404 errors when opening object list or detail pages. The page title and breadcrumb now
  use the authenticated list endpoint instead of the admin-only configuration endpoint.

* **Object Management List Columns tab visible**

  The List Columns tab in Object Management detail was hidden due to a missing async pipe. This has been corrected.

* **Object Management list column delete button works**

  The delete button in the List Columns tab now correctly removes the column. Previously, clicking delete showed the
  confirmation modal but confirmation did nothing due to a template binding issue.

* **Saving and updating search list columns no longer fails with "not found"**

  Updating a search list column that was resolved by owner and key (rather than by id) failed with an "entity not
  found" error. The lookup now falls back correctly, so creating, updating, and deleting list columns works as
  expected.
