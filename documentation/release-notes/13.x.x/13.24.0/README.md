# 13.24.0

{% hint style="info" %}
**Release date 15-04-2026**
{% endhint %}

## New Features

* **Redirect to case detail after form flow completion**

  When a case is created via a form flow, the user is now automatically redirected to the newly created case detail page
  after completing the last step. Previously, the user was returned to the case list without any indication of which case
  was created.

* **Publish & Receive notification plugin action for Notificaties API**

  A new plugin action "Publiceer een notificatie" and "Ontvang een notificatie" have been added to the Notificaties API
  plugin. This action allows publishing and receiving notifications via the Notificaties API from a BPMN process.
  Documentation can be found in
  the [Notificaties API plugin configuration guide](../../../features/plugins/configure-notificaties-api-plugin.md).

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Security

* **Dependencies**

  All frontend dependencies have been locked to specific versions.

## Bugfixes

* When a new version of a building block is created, forms and form flows are also copied over.
