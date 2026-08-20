# 13.43.0

{% hint style="info" %}
**Release date 26-08-2026**
{% endhint %}

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* **Notificaties API subscriptions no longer cause a restart loop on startup**

  Registering a subscription happened before Valtimo could be reached, so the Notificaties API
  validation callback failed and the application shut itself down. Registration now runs in the
  background and is retried with exponential backoff until it succeeds. See the
  [Notificaties API module documentation](../../../fundamentals/getting-started/modules/zgw/notificaties-api.md)
  for the new `valtimo.zgw.abonnement-registration` properties.
