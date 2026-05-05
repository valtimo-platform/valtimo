# 13.28.0

{% hint style="info" %}
**Release date xx-xx-2026**
{% endhint %}

## Enhancements

* **Skip Valtimo's database migrations**

  A new setting lets you disable Valtimo's built-in database migrations, so they can be run from
  a separate job instead.

## Bugfixes

* **Recover from stuck migration locks**

  If an application instance was killed mid-migration, the migration lock could stay held and
  prevent other instances from starting. Valtimo now releases such stale locks automatically on
  startup and on graceful shutdown.
