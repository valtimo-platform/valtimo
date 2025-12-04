# 13.6.0

{% hint style="info" %}
**Release date 27-November - 2025**
{% endhint %}

## New Features

**Date status set added to Zaken API plugin**

A new field has been added to the set-zaakstatus action in the Zaken API plugin that allows setting the date of a zaak-status.

**New action is added to Zaken API plugin**

A new action has been added to zaken api plugin allowing to collect zaak-besluiten

**New action is added to Besluiten API plugin**

The Besluiten API plugin is extended with a plugin action that allows the expiration date and expiration reason of a previously recorded decision to be updated.

**Map widget**

A new case widget type has been added called the _map widget_. This widget shows a world map with geometry drawn on top of it.

**Case widget action button**

All case widget types except for interactive table now allow for configuring an action button. This button can be used to either start a case or redirect to an external link.

**Variable UI** **improvements**&#x20;



## Bugfixes

* When the `disableCaseCount` feature toggle is set to `true`, the number of open cases will no longer be shown in the menu.
* Migrations to Valtimo 13 now take into account usernames that look like email addresses to find the correct users in Keycloak.
* General performance improvements for migration scripts when retrieving users from keycloak.
* Radio button options now display horizontally when selecting Inline Layout in Form.io. The label spacing for radio buttons is also now consistent with other form elements
* Fixed the issue with the case version tag when exporting BPMN process
* Provided a fix if the x-timezone-offset header is not available the application will no longer use a provided fallback zone/offset
