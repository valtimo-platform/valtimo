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

* **Case inspection shows the case definition key and version**

  The metadata tab of the case inspection page now shows the key and version of the case definition the case was
  created from. Only the name of the document definition was shown before, which made it impossible to tell which
  version of a case definition a case belongs to.

## Bugfixes

* **Searching on a date returns results again**

  Picking a date in a search field, such as **Geboortedatum** under **Achternaam en geboortedatum** in a Beelden
  search, passed the date on in a format the external source did not accept, so the search stayed empty.

* **Notificaties API subscriptions no longer cause a restart loop on startup**

  Registering a subscription happened before Valtimo could be reached, so the Notificaties API
  validation callback failed and the application shut itself down. Registration now runs in the
  background and is retried with exponential backoff until it succeeds. See the
  [Notificaties API module documentation](../../../fundamentals/getting-started/modules/zgw/notificaties-api.md)
  for the new `valtimo.zgw.abonnement-registration` properties.
