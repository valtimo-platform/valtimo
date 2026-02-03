# 13.14.0

{% hint style="info" %}
**Release date 04-02-2026**
{% endhint %}

## New Features

* **Setting case retention date**

  The _retention period_ is an internal status property that, when set, calculates the expiration date for the case.<br>When that date is reached, the case and all associated processes (including process history) will be deleted. If present, the case is also removed from connected ZGW platforms (for example, case details, objects, and uploaded documents).
  See [Internal status](../../../features/case/case-detail/statuses.md) for the configuration of the retention date.

  +  **Note:** when the case internal status is set where the retention period is set to -1, no new retention date will be calculated, and any existing retention date will be cleared.

## Enhancements

* **Added vernietigingsdatum and status to Link document to zaak**

  The 'Link document to zaak' plugin action now supports two additional optional properties: `vernietigingsdatum` (destruction date) and `status`. These properties are included in the 'zaakinformatieobject' request when linking a document to a zaak.
 
* **Allow access to Spring Actuator readiness and liveness health endpoints when details are omitted**

  This behaviour, previously limited to `/{base-path}/health`, now also applies to `/{base-path}/health/readiness` and `/{base-path}/health/liveness`. (In Valtimo, `base-path` is usually set to `/management`).
  These endpoints can be used by cloud services to determine whether the application has started successfully and is ready to receive traffic.

* **ZGW: Documenten API document deletion**

  When deleting a case (zaak), linked documents are now only deleted from the Documenten API if they are not
  linked to any other cases. If a document is linked to multiple cases, only the relationship between the
  case and the document is removed.

## Bugfixes

* The `Create Zaak` action for the Zaken Api Plugin now correctly links the created zaak to the
  case when configured for a building block.
* The case detail context menu now only shows the Unassign action when the user has the assign permission.
