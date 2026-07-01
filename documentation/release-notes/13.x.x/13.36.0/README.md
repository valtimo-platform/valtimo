# 13.36.0

{% hint style="info" %}
**Release date TBD**
{% endhint %}

## New Features

* **Object Management Select Form.io component**

  A new Form.io component for selecting objects from an Object Management configuration. Available under "Advanced" in
  the form builder. Features:
  - Configurable columns with sorting and filtering
  - Pagination
  - Multiple selection with min/max validation
  - Value formats: `id` (UUID only), `full` (entire object), `columns` (configured column values)
  
  See [Object Management Select](../../../features/objecten-management/object-management-select.md) for configuration
  details.

* **Object Management access control (PBAC)**

  Object Management configurations can now be secured with Permission Based Access Control. When enabled with
  `valtimo.object-management.authorization.enabled=true`, `view` and `view_list` permissions control which
  configurations appear in the menu and which object lists, detail pages, and form components a user can access.
  The feature is disabled by default; when disabled, all authenticated users retain full access. See
  [Access control](../../../features/objecten-management/access-control.md) for details.

* **Object Management list sorting**

  Object lists now support column sorting. Columns can be configured with a default sort direction (ascending or
  descending) that applies on initial load. Resolves
  [#125](https://github.com/generiekzaakafhandelcomponent/gzac-issues/issues/125).

## Bugfixes

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
