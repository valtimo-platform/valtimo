# 13.32.0

{% hint style="info" %}
**Release date 10-06-2026**
{% endhint %}

## Features

* **Load a zaak in a form flow**

  A new `zakenFormFlow` bean lets form flows load a zaak from the Zaken API by its `identificatie` through a `getZaak`
  method that can be used in SpEL expressions (for example `onOpen` or `onComplete`). The full zaak is returned, so any
  of its fields can be used in subsequent steps or conditions. Access is secured with PBAC: a new `Zaak` resource type
  with a `view` action ensures only users authorized for the matching zaaktype can load a zaak. See
  [Load a zaak in a form flow](../../../features/zgw/load-zaak-in-form-flow.md) for details.

## Enhancements

* **`documentId` added to `FormCustomComponent` interface**

  The [`FormCustomComponent`](../../../customizing-valtimo/front-end-customization/custom-components/custom-ui-component-process-link.md) interface
  (`@valtimo/process-link`) now includes a `documentId` property. This allows custom UI components used as process
  links to know which document they are operating on, enabling them to start supporting processes or complete user
  tasks for the correct case.
  
* **Access control overview tab**

  A new overview tab presents the permissions in a human-readable manner.

* **Server-side input validation hardening (NCSC U/WA.03-1)**

  REST controllers across the backend now apply Bean Validation to applicable endpoints that accept a
  request body.

* **Metroline widget available for IKO widget tabs**

  The metroline widget can now be added to IKO widget tabs, allowing case progress to be visualised alongside other
  case information shown to customers.

* **Full case name shown on hover in the Cases menu**

  Hovering over a case in the Cases menu now displays the full case name as a tooltip.

## Bugfixes

* **Form View Model and UI component process links did not work correctly for user tasks**

  Several issues prevented [Form View Model](../../../features/process/process-link.md#creating-a-form-view-model-process-link)
  and [UI component](../../../features/process/process-link.md#creating-a-ui-component-process-link) process links from
  functioning correctly when used on user tasks. The FVM component received a null `taskInstanceId`, preventing the
  form from loading. The UI component's `submittedEvent` did not trigger the task completion flow, so the task list was
  not refreshed after submission. Both issues have been resolved: `taskInstanceId` is now passed directly when creating
  the dynamic component, and the `submittedEvent` handler now calls `completeTask` to run the full completion flow.

* **Start modals showed stale content when switching between process link types**

  When reopening the start modal with a different process, previously rendered FVM or custom UI components were not
  cleared, and the supporting process start modal incorrectly showed a loading spinner for FVM process links. Dynamic
  component containers are now cleared on each process link load, and the loading state is managed correctly.

## Security

* **Documented recommended Keycloak session and logout settings**

  Valtimo's Keycloak configuration documentation now includes step-by-step admin-console instructions for the
  recommended session timeout values and for enabling refresh-token revocation on logout. See
  [Configuring Keycloak](../../../running-valtimo/application-configuration/configuring-keycloak.md) for the new
  sections. 
