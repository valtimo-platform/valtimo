# 13.25.0

{% hint style="info" %}
**Release date 22-04-2026**
{% endhint %}

## New Features

* **Decision table support for building blocks**

  Building blocks can now have their own DMN decision tables. Decision tables can be deployed, edited, and deleted
  from the **Decision tables** tab in the building block management page. They can be used in business rule tasks
  within the building block's processes. Decision tables are included in building block import and export, and can be
  auto-deployed by placing `.dmn` files in the `config/building-block/<key>/<version>/dmn/` directory. See
  [Building block decision tables](../../features/building-blocks/decision-tables.md) for more information.

* **New Notificaties API plugin actions**
  
  A new plugin action "Publiceer een notificatie" and "Ontvang een notificatie" have been added to the Notificaties API
  plugin. This action allows publishing and receiving notifications via the Notificaties API from a BPMN process.
  Documentation can be found in
  the [Notificaties API plugin configuration guide](../../../features/plugins/configure-notificaties-api-plugin.md).

* **Documenten API plugin: link and unlink documents to objects (experimental)**

  A new experimental Documenten API plugin version has been added with support for the
  `objectinformatieobjecten` endpoint. This version introduces two new plugin actions:

  - **Link document to object** — creates an `ObjectInformatieObject` link between a document
    stored in the Documenten API and any ZGW object (e.g. a Zaak, Besluit, or custom object).
    After linking, the process variables `objectInformatieObjectUrl` and `objectInformatieObjectId`
    are set for downstream use.
  - **Delete document link** — removes an existing `ObjectInformatieObject` link by its URL.

  Both actions are only available when the configured Documenten API version supports the
  `objectinformatieobjecten` API. Experimental versions are sorted to the end of the version
  list in the plugin configurator.

* **Document-level access control for ZGW documents**

  Permissions for ZGW documents can now include conditions on document properties such as confidentiality level,
  status, and document type. This allows administrators to control which documents a user can view, modify, or delete
  based on the document's properties — not just the case it belongs to. Action buttons in the documents tab
  automatically reflect these permissions.

  For more information, see [ZGW Documents - Access control](../../../features/case/zgw/zgw-documents/access-control.md).


## Bugfixes

* Fixed Documenten API document preview not working for non-admin users.

* Fixed duplicate document definitions being created, which caused the error "Query did not return a unique result".
