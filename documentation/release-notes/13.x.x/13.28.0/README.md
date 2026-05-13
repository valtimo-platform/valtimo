# 13.28.0

{% hint style="info" %}
**Release date 13-05-2026**
{% endhint %}

## New Features

* **Dutch address support in map widgets**

  The map widget can now render a layer that points at a Dutch address object instead of a GeoJSON geometry. Valtimo
  geocodes the address to a WGS84 coordinate via
  the [PDOK Locatieserver](https://api.pdok.nl/bzk/locatieserver/search/v3_1/ui/) and renders the result as a `Point`.
  See the [Map widget documentation](../../../features/case/tabs/widgets.md) for the full list of recognised fields and
  a configuration example.

## Enhancements

* **Persistent page sizes per case definition for task list and case list**

  When a user configures the page size for a case definition, either for the task or case list, this is remembered.
  Next time they visit the task or case list for that case definition, the same page size is shown.
* **Person card widget**

  A new `person-card` widget type displays personal data for a single person (full name, birthdate, BSN, phone, email
  and city) in a compact card format on the case detail page. Field values are configured as JSON paths into the case
  document, and only the full name is required — empty fields are hidden in the rendered card. See the
  [Person card widget documentation](../../../features/case/case-detail/tabs/widgets.md) for the full list of fields
  and a configuration example.

* **Metroline widget**

  A new `metroline` widget type visualises the progression of a status as an ordered set of steps, similar to a
  metro-line diagram. The currently active step is highlighted and completed steps display the date and time
  they were reached. When a label is available for a step, an info toggletip is shown next to it so the label
  can be read on demand. Steps can be laid out horizontally or vertically, and are driven either by the internal
  case status history or, when the `zaken-api` module is on the classpath, by the statustypen of the linked
  zaaktype. See the
  [Metroline widget documentation](../../../features/case/case-detail/tabs/widgets.md) for the full configuration.

* **Highlight widget**

  A new `highlight` widget type emphasises a single value or the count of items in a collection on the case detail
  page. The configured JSON path resolves to a primitive value (string, number, boolean). Highlight widgets are
  always one column wide, use the selected accent colour for the left border and optional icon, and can include an
  optional action button (process or link). See the
  [Highlight widget documentation](../../../features/case/case-detail/tabs/widgets.md) for the full list of
  configuration options.

## Enhancements

* **Generic case list**

  A generic case list can be used instead of the default case list with case definitions listed in the sidebar. The
  generic case list shows cases across all case definitions similar to the task list. This feature needs to be enabled
  in the angular configuration file(s) in order to make use of it, via the `enableGenericCaseList` property.
* **Improved actuator endpoint security**

  Endpoints added to `management.endpoints.web.exposure.include` are now
  automatically protected — no filter chain override needed.

* **Hardened anonymous health responses**

  Anonymous calls to `/actuator/health` only return the overall status;
  component details require the actuator role. Kubernetes probes and load
  balancers are unaffected.

  {% hint style="warning" %}
  Health groups (e.g. `liveness`, `readiness`) configured with
  `show-details: ALWAYS` previously exposed component details to anonymous
  callers. They are now also reduced to status-only for unauthenticated
  requests. Authenticate with the actuator role to keep seeing details.
  {% endhint %}
  
* **Faster Case Progress tab**

  The Progress tab on the case details page now loads noticeably faster, especially for cases with many associated
  processes.

* **Open widget link in a new browser tab**

  Link-type action buttons on case widgets now support an "Open in new tab" option in widget management.
  When enabled, clicking the button opens the configured URL in a new browser tab instead of replacing
  the case detail page.

## Bugfixes

* SmartDocuments compatibility with newer SmartDocuments versions.
* When a header widget was configured, it was not possible to edit the header widget.
* Fixed a permission issue on the task endpoint that prevented assignee details from being resolved for users without permission to look up other users.
* Fixed a bug where the enumeration display type when configuring task columns was not editable.
* Quick search tooltip on the case list no longer gets cut off when the trigger is near the viewport edge; the tooltip now repositions automatically to stay on screen.

* **Recover from stuck migration locks**

  If an application instance was killed mid-migration, the migration lock could stay held and
  prevent other instances from starting. Valtimo now releases such stale locks automatically on
  startup and on graceful shutdown.
