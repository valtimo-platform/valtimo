# 13.25.1

{% hint style="info" %}
**Release date 12-06-2026**
{% endhint %}

{% hint style="info" %}
The bugfix in this release does not apply to all versions going forward. 13.33.0 is the first version that applies the fix after this version.
{% endhint %}

## Bugfixes

* **Keycloak-based database migrations failed against newer Keycloak servers**

  Database migrations that look up users in Keycloak could fail to start when running against a newer Keycloak
  version than the one Valtimo ships with. This has been resolved.
