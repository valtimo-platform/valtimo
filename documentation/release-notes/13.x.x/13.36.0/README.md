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

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* Dashboard widgets can now group and filter on more case fields, such as the `case:internalStatus` and
  `case:definitionId.key`.

* **Shared task list URLs now open on the correct tab**

  Opening a copied or bookmarked task list URL now lands on the tab it was saved from (for example *All tasks*),
  instead of defaulting to the first tab.
