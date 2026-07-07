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

* **Image widget**

  A new image widget can be added to a case detail tab to display image files that are stored on the case. The
  widget resolves a value resolver path (for example `doc:/uploadedFiles`) to one or more uploaded file resources
  and renders the ones that are browser-renderable images (`png`, `jpg`, `jpeg`, `gif`, `webp`, `avif`, `svg`,
  `bmp`, `ico`). By default the images are shown in a grid, but a **Display as carousel** option presents them one
  at a time with navigation dots and previous/next arrows. See
  [Widgets](../../../features/case/case-detail/tabs/widgets.md) for the configuration details.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* Dashboard widgets can now group and filter on more case fields, such as the `case:internalStatus` and
  `case:definitionId.key`.
