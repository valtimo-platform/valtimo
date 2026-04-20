# 13.25.0

{% hint style="info" %}
**Release date 22-04-2026**
{% endhint %}

## New Features

  A new plugin action "Publiceer een notificatie" and "Ontvang een notificatie" have been added to the Notificaties API
  plugin. This action allows publishing and receiving notifications via the Notificaties API from a BPMN process.
  Documentation can be found in
  the [Notificaties API plugin configuration guide](../../../features/plugins/configure-notificaties-api-plugin.md).

* **Document-level access control for ZGW documents**

  Permissions for ZGW documents can now include conditions on document properties such as confidentiality level,
  status, and document type. This allows administrators to control which documents a user can view, modify, or delete
  based on the document's properties — not just the case it belongs to. Action buttons in the documents tab
  automatically reflect these permissions.

  For more information, see [ZGW Documents - Access control](../../../features/case/zgw/zgw-documents/access-control.md).


## Bugfixes

* Fixed duplicate document definitions being created, which caused the error "Query did not return a unique result".
