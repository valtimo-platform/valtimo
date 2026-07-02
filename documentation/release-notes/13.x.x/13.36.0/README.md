# 13.36.0

{% hint style="info" %}
**Release date xx-xx-2026**
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
