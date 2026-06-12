# 13.33.0

{% hint style="info" %}
**Release date 17-06-2026**
{% endhint %}

## New Features

* **New feature title**

  New feature explanation.

## Enhancements

* **New enhancement title**

  New enhancement explanation.

## Bugfixes

* **Keycloak-based database migrations failed against newer Keycloak servers**

  Database migrations that look up users in Keycloak could fail to start when running against a newer Keycloak
  version than the one Valtimo ships with. This has been resolved.

* **Misleading plugin configuration error when configuring a building block call activity**

  When a call activity to a building block was missing the required business key configuration, saving the
  process link failed with a confusing "No plugin configuration mapping provided" message. Valtimo now checks
  the call activity up front and shows a clear error that points to the missing business key configuration.
