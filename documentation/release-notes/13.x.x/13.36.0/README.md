# 13.36.0

{% hint style="info" %}
**Release date 08-07-2026**
{% endhint %}

## New Features

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

* **Start forms configured to open in a panel opened in a modal instead**

  A supporting process started from the **Start** button always opened its start form in a modal, even when the process
  link was configured with **Display type: Panel**. The configured display type is now respected
  again, so these start forms open in the case detail panel as intended.
